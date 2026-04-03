import { prisma } from "@/lib/prisma";
import { runRegexRule } from "./regex-runner";
import { runAstRule } from "./ast-runner";
import { scoreFindings } from "./scorer";
import type { Finding, Language, ScanResult } from "./types";

export type { Finding, Language, ScanResult };

export async function scanCode(
  code: string,
  language: Language,
  filePath: string = "paste"
): Promise<ScanResult> {
  const rules = await prisma.rule.findMany({
    where: { enabled: true },
  });

  const findings: Finding[] = [];

  for (const rule of rules) {
    // Skip rules not applicable to this language
    if (
      !rule.languages.includes(language) &&
      !rule.languages.includes("*")
    ) {
      continue;
    }

    if (rule.patternType === "REGEX") {
      findings.push(...runRegexRule(rule, code, filePath));
    } else if (rule.patternType === "AST") {
      findings.push(...runAstRule(rule, code, filePath));
    }
    // FILE rules are handled at the project level, not per-paste
  }

  // Deduplicate: same rule + same file + same line
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
