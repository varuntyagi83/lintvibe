import { runRegexRule } from "../../src/lib/engine/regex-runner";
import { runAstRule } from "../../src/lib/engine/ast-runner";
import { scoreFindings } from "../../src/lib/engine/scorer";
import type { Finding, Language, ScanResult } from "../../src/lib/engine/types";
import { RULES } from "./rules";

export type { Finding, Language, ScanResult };

export interface FileEntry {
  path: string;
  content: string;
  language: Language;
}

function detectMiddlewareAuth(files: FileEntry[]): boolean {
  const mw = files.find((f) => /(?:^|\/)middleware\.[jt]sx?$/.test(f.path));
  if (!mw) return false;
  return /getServerSession|auth\s*\(\s*\)|withAuth|clerkMiddleware|authMiddleware|NextAuth|createMiddleware|currentUser|validateSession/i.test(
    mw.content
  );
}

function scanOneFile(code: string, language: Language, filePath: string): Finding[] {
  const findings: Finding[] = [];
  for (const rule of RULES) {
    if (!rule.enabled) continue;
    if (!rule.languages.includes(language) && !rule.languages.includes("*")) continue;
    if (rule.patternType === "REGEX") {
      findings.push(...runRegexRule(rule, code, filePath));
    } else if (rule.patternType === "AST") {
      findings.push(...runAstRule(rule, code, filePath));
    }
  }
  return findings;
}

export function scanFiles(files: FileEntry[]): ScanResult & { linesScanned: number } {
  const hasMiddlewareAuth = detectMiddlewareAuth(files);
  const allFindings: Finding[] = [];
  let linesScanned = 0;

  for (const file of files) {
    const findings = scanOneFile(file.content, file.language, file.path);
    allFindings.push(...findings);
    linesScanned += file.content.split("\n").length;
  }

  // Dedup: same rule + same file + same line
  const seen = new Set<string>();
  const deduped = allFindings.filter((f) => {
    const key = `${f.ruleId}:${f.filePath}:${f.lineNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (hasMiddlewareAuth) {
    for (const f of deduped) {
      if (f.ruleId === "missing-auth-api") {
        f.severity = "LOW";
        f.description =
          "Auth middleware detected — this route may already be protected. Verify your middleware matcher covers this path.";
      }
    }
  }

  return { ...scoreFindings(deduped, linesScanned), linesScanned };
}
