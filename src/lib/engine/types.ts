export type Language = "javascript" | "typescript" | "python" | "json";

export interface RawRule {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  patternType: string;
  pattern: unknown;
  languages: string[];
  aiTools: string[];
  fixTemplate: string | null;
  enabled: boolean;
}

export interface Finding {
  ruleId: string;
  filePath: string;
  lineNumber: number | null;
  lineEnd: number | null;
  codeSnippet: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  aiTools: string[];
  fixTemplate: string | null;
}

export interface ScanResult {
  findings: Finding[];
  riskScore: number;
  grade: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  topCategories: { category: string; count: number }[];
  linesScanned: number;
}
