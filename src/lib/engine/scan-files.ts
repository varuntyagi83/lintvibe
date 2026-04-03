import { scanCode } from "./index";
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

  const ext = "." + normalized.split(".").pop()?.toLowerCase();
  return SCANNABLE_EXTENSIONS[ext] ?? null;
}

export async function scanFiles(
  files: FileEntry[]
): Promise<{
  allFindings: Finding[];
  linesScanned: number;
  fileCount: number;
}> {
  const limited = files.slice(0, MAX_FILES);
  const allFindings: Finding[] = [];
  let linesScanned = 0;

  for (const file of limited) {
    const content = file.content.slice(0, MAX_FILE_SIZE);
    const result = await scanCode(content, file.language, file.path);
    allFindings.push(...result.findings);
    linesScanned += result.linesScanned;
  }

  return { allFindings, linesScanned, fileCount: limited.length };
}
