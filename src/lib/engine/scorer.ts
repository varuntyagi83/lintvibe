import type { Finding, ScanResult } from "./types";

const SEVERITY_WEIGHTS: Record<string, number> = {
  CRITICAL: 40,
  HIGH: 20,
  MEDIUM: 6,
  LOW: 1,
  INFO: 0,
};

export function scoreFindings(
  findings: Finding[],
  linesScanned: number
): ScanResult {
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  const categoryCounts: Record<string, number> = {};

  for (const f of findings) {
    counts[f.severity as keyof typeof counts] =
      (counts[f.severity as keyof typeof counts] ?? 0) + 1;
    categoryCounts[f.category] = (categoryCounts[f.category] ?? 0) + 1;
  }

  // Risk score: weighted sum capped at 100
  const raw = Object.entries(counts).reduce(
    (sum, [sev, count]) => sum + count * (SEVERITY_WEIGHTS[sev] ?? 0),
    0
  );
  const riskScore = Math.min(100, Math.round(raw));

  // Grade
  let grade = "A";
  if (counts.CRITICAL > 0) grade = "F";
  else if (counts.HIGH >= 3) grade = "D";
  else if (counts.HIGH >= 1) grade = "C";
  else if (counts.MEDIUM >= 3) grade = "B";

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  return {
    findings,
    riskScore,
    grade,
    totalFindings: findings.length,
    criticalCount: counts.CRITICAL,
    highCount: counts.HIGH,
    mediumCount: counts.MEDIUM,
    lowCount: counts.LOW,
    infoCount: counts.INFO,
    topCategories,
    linesScanned,
  };
}
