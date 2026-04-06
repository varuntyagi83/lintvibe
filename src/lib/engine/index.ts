import { prisma } from "@/lib/prisma";
import { runRegexRule } from "./regex-runner";
import { runAstRule } from "./ast-runner";
import { scoreFindings } from "./scorer";
import type { Finding, Language, RawRule, ScanResult } from "./types";

export type { Finding, Language, ScanResult };

/** Fetch all enabled rules once — pass to scanCodeWithRules to avoid N+1. */
export async function fetchRules(): Promise<RawRule[]> {
  return prisma.rule.findMany({ where: { enabled: true } });
}

/** Scan a single file's code using pre-fetched rules. No DB calls. */
export function scanCodeWithRules(
  code: string,
  language: Language,
  filePath: string,
  rules: RawRule[]
): ScanResult {
  const findings: Finding[] = [];

  for (const rule of rules) {
    if (!rule.languages.includes(language) && !rule.languages.includes("*")) continue;
    if (rule.patternType === "REGEX") findings.push(...runRegexRule(rule, code, filePath));
    else if (rule.patternType === "AST") findings.push(...runAstRule(rule, code, filePath));
  }

  const seen = new Set<string>();
  const deduped = findings.filter((f) => {
    const key = `${f.ruleId}:${f.filePath}:${f.lineNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const linesScanned = code.split("\n").length;
  return scoreFindings(deduped, linesScanned);
}

/** Convenience wrapper for paste scans — fetches rules internally. */
export async function scanCode(
  code: string,
  language: Language,
  filePath: string = "paste"
): Promise<ScanResult> {
  const rules = await fetchRules();
  return scanCodeWithRules(code, language, filePath, rules);
}
