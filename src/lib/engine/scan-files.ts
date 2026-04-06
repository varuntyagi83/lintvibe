import { fetchRules, scanCodeWithRules } from "./index";
import { analyzeProjectGraph } from "./project-graph";
import { scanDependencies } from "./dep-scanner";
import { getRiskCategories } from "./risk-categories";
import type { Finding, Language } from "./types";

const SCANNABLE_EXTENSIONS: Record<string, Language> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".py": "python",
};

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "out",
  "__pycache__",
  ".venv",
  "venv",
  "coverage",
  ".turbo",
  "prisma",   // seed/migration files are schema management, not application code
]);

const MAX_FILE_SIZE = 500_000; // 500 KB per file
const MAX_FILES = 500;

export interface FileEntry {
  path: string;
  content: string;
  language: Language;
}

export function isScannablePath(filePath: string): Language | null {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/");

  // Skip any path that contains a blocked directory
  if (parts.some((p) => SKIP_DIRS.has(p))) return null;

  // Special case: include package.json for dependency vulnerability scanning
  const filename = parts[parts.length - 1];
  if (filename === "package.json") return "json";

  const ext = "." + normalized.split(".").pop()?.toLowerCase();
  return SCANNABLE_EXTENSIONS[ext] ?? null;
}

/**
 * Detect whether the project has a Next.js middleware file that handles auth
 * for API routes. If so, per-route auth checks are redundant.
 */
function detectMiddlewareAuth(files: FileEntry[]): boolean {
  const middlewareFile = files.find((f) =>
    /(?:^|\/)middleware\.[jt]sx?$/.test(f.path)
  );
  if (!middlewareFile) return false;

  // Look for any common auth middleware patterns
  return /getServerSession|auth\s*\(\s*\)|withAuth|clerkMiddleware|authMiddleware|NextAuth|createMiddleware|currentUser|validateSession/i.test(
    middlewareFile.content
  );
}

export async function scanFiles(
  files: FileEntry[]
): Promise<{
  allFindings: Finding[];
  linesScanned: number;
  fileCount: number;
}> {
  const limited = files.slice(0, MAX_FILES);

  // Fetch rules once for the entire scan — avoids N+1 DB queries per file
  const rules = await fetchRules();

  // Project-level context: does this codebase protect routes via middleware?
  const hasMiddlewareAuth = detectMiddlewareAuth(limited);

  const allFindings: Finding[] = [];
  let linesScanned = 0;

  for (const file of limited) {
    // JSON files (package.json) are handled by the dependency scanner below
    if (file.language === "json") continue;

    const content = file.content.slice(0, MAX_FILE_SIZE);
    const result = scanCodeWithRules(content, file.language, file.path, rules);
    allFindings.push(...result.findings);
    linesScanned += result.linesScanned;
  }

  // If the project has middleware-level auth, downgrade missing-auth-api from
  // CRITICAL to LOW and add context — routes may be protected by middleware.
  // We keep the finding (middleware coverage isn't guaranteed per-route) but
  // it's no longer critical.
  if (hasMiddlewareAuth) {
    for (const f of allFindings) {
      if (f.ruleId === "missing-auth-api") {
        f.severity = "LOW" as never;
        f.description =
          "Auth middleware detected in this project — this route may already be protected. " +
          "Verify that your middleware matcher covers this path. If it does not, add an inline auth check.";
      }
    }
  }

  // ── Project-graph analysis ──────────────────────────────────────────────────
  // Cross-file semantic rules: IDOR, server-action auth bypass, middleware gaps,
  // mass assignment, secret leaks via client imports, CAPTCHA, security headers.
  const graphFindings = analyzeProjectGraph(limited);
  allFindings.push(...graphFindings);

  // ── Dependency vulnerability scan ───────────────────────────────────────────
  // Parse package.json and flag packages with known CVEs.
  const depFindings = scanDependencies(limited);
  allFindings.push(...depFindings);

  // ── Risk category enrichment ─────────────────────────────────────────────
  // Apply risk categories to all findings based on their ruleId.
  // Graph and dep findings already include riskCategories; AST/regex findings
  // get an empty array from the runners — fill them here.
  for (const f of allFindings) {
    if (!f.riskCategories || f.riskCategories.length === 0) {
      f.riskCategories = getRiskCategories(f.ruleId);
    }
  }

  return { allFindings, linesScanned, fileCount: limited.length };
}
