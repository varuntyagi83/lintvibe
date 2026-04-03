#!/usr/bin/env node
import path from "path";
import { walkDirectory, hasDotEnv } from "./walker";
import { scanFiles } from "./engine";
import { printHeader, printResults, printGate } from "./reporter";

// ─── Arg parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
  vibescan [path] [options]

  Scan a directory for security vulnerabilities introduced by AI coding tools.

  Arguments:
    path              Directory to scan (default: current directory)

  Options:
    --fail-on <sev>   Fail with exit 1 if any finding at this severity or above
                      CRITICAL | HIGH | MEDIUM | LOW  (default: HIGH)
    --output json     Output findings as JSON instead of human-readable text
    --max-files <n>   Max files to scan (default: 500)
    --no-color        Disable colored output

  Examples:
    vibescan .
    vibescan ./src --fail-on CRITICAL
    vibescan . --output json > results.json
    vibescan . --fail-on HIGH --max-files 200

  Exit codes:
    0   Clean — no findings at or above --fail-on threshold
    1   Findings found — pipeline should be blocked
    2   Error (invalid path, permission denied, etc.)
`);
  process.exit(0);
}

// Positional arg (first non-flag arg)
const positional = args.find((a) => !a.startsWith("-") && args[args.indexOf(a) - 1] !== "--fail-on" && args[args.indexOf(a) - 1] !== "--max-files" && args[args.indexOf(a) - 1] !== "--output");
const targetDir = path.resolve(positional ?? ".");
const failOn = (getArg("--fail-on") ?? "HIGH").toUpperCase();
const outputJson = getArg("--output") === "json";
const maxFiles = parseInt(getArg("--max-files") ?? "500", 10);
const noColor = hasFlag("--no-color") || !process.stdout.isTTY;

const VALID_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
if (!VALID_SEVERITIES.includes(failOn)) {
  console.error(`Invalid --fail-on value: ${failOn}. Use: CRITICAL | HIGH | MEDIUM | LOW`);
  process.exit(2);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

import fs from "fs";

if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
  console.error(`Path not found or not a directory: ${targetDir}`);
  process.exit(2);
}

if (!outputJson) {
  printHeader(targetDir, noColor);
}

const files = walkDirectory(targetDir, maxFiles);

// Surface .env files as a finding
if (hasDotEnv(targetDir)) {
  // Inject a synthetic .env finding into the file list by adding a dummy file
  // that triggers the dotenv-committed rule pattern check
  files.push({
    path: ".env",
    content: "# env file present",
    language: "javascript",
  });
}

if (files.length === 0) {
  if (!outputJson) {
    console.log("  No scannable files found (.js, .jsx, .ts, .tsx, .py)");
  }
  process.exit(0);
}

const result = scanFiles(files);

if (outputJson) {
  console.log(JSON.stringify(result, null, 2));
  const shouldFail = result.findings.some((f) => {
    const rank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
    return (rank[f.severity] ?? 0) >= (rank[failOn] ?? 3);
  });
  process.exit(shouldFail ? 1 : 0);
} else {
  printResults(result, files.length, noColor);
  const shouldFail = printGate(result, failOn, noColor);
  process.exit(shouldFail ? 1 : 0);
}
