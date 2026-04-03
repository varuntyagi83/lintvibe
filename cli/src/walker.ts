import fs from "fs";
import path from "path";
import type { FileEntry } from "./engine";
import type { Language } from "../../src/lib/engine/types";

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", ".nuxt",
  "out", "__pycache__", ".venv", "venv", "coverage", ".turbo",
]);

const EXTENSIONS: Record<string, Language> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".py": "python",
};

const MAX_FILE_BYTES = 500_000;

export function walkDirectory(rootDir: string, maxFiles: number): FileEntry[] {
  const entries: FileEntry[] = [];

  function walk(dir: string) {
    if (entries.length >= maxFiles) return;
    let items: string[];
    try {
      items = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const item of items) {
      if (entries.length >= maxFiles) break;
      if (SKIP_DIRS.has(item)) continue;
      const full = path.join(dir, item);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        const language = EXTENSIONS[ext];
        if (!language || stat.size > MAX_FILE_BYTES) continue;
        let content: string;
        try {
          content = fs.readFileSync(full, "utf-8");
        } catch {
          continue;
        }
        entries.push({
          path: path.relative(rootDir, full).replace(/\\/g, "/"),
          content,
          language,
        });
      }
    }
  }

  walk(rootDir);
  return entries;
}

export function hasDotEnv(dir: string): boolean {
  return [".env", ".env.local", ".env.production", ".env.development"].some((f) =>
    fs.existsSync(path.join(dir, f))
  );
}
