import type { ScanResult, Finding } from "./engine";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightWhite: "\x1b[97m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
};

function color(noColor: boolean, ...codes: string[]) {
  return noColor ? "" : codes.join("");
}

const SEV_COLOR: Record<string, string[]> = {
  CRITICAL: [c.bgRed, c.bold, c.white],
  HIGH: [c.brightRed, c.bold],
  MEDIUM: [c.brightYellow, c.bold],
  LOW: [c.blue, c.bold],
  INFO: [c.dim],
};

const GRADE_COLOR: Record<string, string[]> = {
  A: [c.brightGreen, c.bold],
  B: [c.green, c.bold],
  C: [c.brightYellow, c.bold],
  D: [c.yellow, c.bold],
  F: [c.brightRed, c.bold],
};

function sevTag(severity: string, noColor: boolean): string {
  const col = SEV_COLOR[severity] ?? [c.dim];
  return `${color(noColor, ...col)} ${severity.padEnd(8)} ${color(noColor, c.reset)}`;
}

function hr(char = "─", len = 72, noColor = false): string {
  return `${color(noColor, c.dim)}${char.repeat(len)}${color(noColor, c.reset)}`;
}

// ─── Main reporter ────────────────────────────────────────────────────────────

export function printHeader(targetPath: string, noColor: boolean) {
  console.log();
  console.log(
    `${color(noColor, c.bold, c.brightRed)}VibeScan${color(noColor, c.reset)}  ` +
      `${color(noColor, c.dim)}v0.1.0 — AI Code Security Scanner${color(noColor, c.reset)}`
  );
  console.log(`${color(noColor, c.dim)}Scanning ${targetPath}…${color(noColor, c.reset)}`);
}

export function printProgress(fileCount: number, noColor: boolean) {
  process.stdout.write(
    `\r${color(noColor, c.dim)}  ${fileCount} files processed…${color(noColor, c.reset)}  `
  );
}

export function printResults(
  result: ScanResult,
  fileCount: number,
  noColor: boolean
) {
  // Clear progress line
  process.stdout.write("\r" + " ".repeat(60) + "\r");

  const { findings } = result;

  console.log(
    `${color(noColor, c.dim)}${fileCount} files · ` +
      `${result.linesScanned.toLocaleString()} lines scanned${color(noColor, c.reset)}`
  );
  console.log();

  if (findings.length === 0) {
    console.log(
      `${color(noColor, c.brightGreen, c.bold)}✓ No vulnerabilities found${color(noColor, c.reset)}`
    );
    printSummary(result, noColor);
    return;
  }

  // Group by severity
  const groups = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map((sev) => ({
    sev,
    items: findings.filter((f) => f.severity === sev),
  })).filter((g) => g.items.length > 0);

  for (const { sev, items } of groups) {
    const col = SEV_COLOR[sev] ?? [c.dim];
    console.log(
      `${color(noColor, ...col)}${sev}${color(noColor, c.reset)} ` +
        `${color(noColor, c.dim)}(${items.length} finding${items.length !== 1 ? "s" : ""})${color(noColor, c.reset)}`
    );
    console.log(hr("─", 72, noColor));

    for (const f of items) {
      printFinding(f, noColor);
    }
    console.log();
  }

  printSummary(result, noColor);
}

function printFinding(f: Finding, noColor: boolean) {
  const loc = f.lineNumber ? `:${f.lineNumber}` : "";
  console.log(
    `  ${color(noColor, c.bold)}${f.title}${color(noColor, c.reset)}`
  );
  console.log(
    `  ${color(noColor, c.cyan)}${f.filePath}${loc}${color(noColor, c.reset)}  ` +
      `${color(noColor, c.dim)}${f.category}${color(noColor, c.reset)}`
  );

  if (f.codeSnippet) {
    const snippet = f.codeSnippet.split("\n").slice(0, 3).join("\n");
    const indented = snippet
      .split("\n")
      .map((l) => `    ${color(noColor, c.dim)}${l}${color(noColor, c.reset)}`)
      .join("\n");
    console.log(indented);
  }

  console.log(
    `  ${color(noColor, c.dim)}${f.description}${color(noColor, c.reset)}`
  );

  if (f.fixTemplate) {
    console.log(
      `  ${color(noColor, c.green)}Fix:${color(noColor, c.reset)} ` +
        `${color(noColor, c.dim)}${f.fixTemplate}${color(noColor, c.reset)}`
    );
  }
  console.log();
}

function printSummary(result: ScanResult, noColor: boolean) {
  console.log(hr("─", 72, noColor));

  const gradeCol = GRADE_COLOR[result.grade] ?? [c.dim];
  const scoreColor =
    result.riskScore >= 80
      ? [c.brightGreen]
      : result.riskScore >= 60
      ? [c.brightYellow]
      : result.riskScore >= 40
      ? [c.yellow]
      : [c.brightRed];

  console.log(
    `  ${color(noColor, c.bold)}Risk score${color(noColor, c.reset)}  ` +
      `${color(noColor, ...scoreColor, c.bold)}${result.riskScore}/100${color(noColor, c.reset)}    ` +
      `${color(noColor, c.bold)}Grade${color(noColor, c.reset)}  ` +
      `${color(noColor, ...gradeCol)}${result.grade}${color(noColor, c.reset)}`
  );
  console.log(
    `  ${color(noColor, c.brightRed)}Critical ${result.criticalCount}${color(noColor, c.reset)}   ` +
      `${color(noColor, c.red)}High ${result.highCount}${color(noColor, c.reset)}   ` +
      `${color(noColor, c.yellow)}Medium ${result.mediumCount}${color(noColor, c.reset)}   ` +
      `${color(noColor, c.blue)}Low ${result.lowCount}${color(noColor, c.reset)}`
  );
  console.log();
}

export function printGate(
  result: ScanResult,
  failOn: string,
  noColor: boolean
): boolean {
  const SEV_RANK: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
    INFO: 0,
  };
  const threshold = SEV_RANK[failOn] ?? 3;

  const blocking = result.findings.filter(
    (f) => (SEV_RANK[f.severity] ?? 0) >= threshold
  );

  if (blocking.length === 0) {
    console.log(
      `${color(noColor, c.brightGreen, c.bold)}✓ Pipeline clear${color(noColor, c.reset)} ` +
        `${color(noColor, c.dim)}— no findings at or above ${failOn}${color(noColor, c.reset)}`
    );
    console.log();
    return false; // don't fail
  }

  console.log(
    `${color(noColor, c.brightRed, c.bold)}✗ ${blocking.length} ${failOn}+ finding${blocking.length !== 1 ? "s" : ""} — pipeline blocked${color(noColor, c.reset)}`
  );
  console.log(
    `${color(noColor, c.dim)}  Fix these before merging or raise the threshold with --fail-on MEDIUM${color(noColor, c.reset)}`
  );
  console.log();
  return true; // fail
}
