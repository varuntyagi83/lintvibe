import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanSummary {
  grade: string;
  riskScore: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  totalCount: number;
}

interface Finding {
  id: string;
  ruleId: string;
  filePath: string;
  lineNumber: number | null;
  codeSnippet: string | null;
  severity: string;
  category: string;
  title: string;
  description: string;
  aiExplanation: string | null;
  fixSuggestion: string | null;
  fixTemplate: string | null;
}

interface ScanReportProps {
  scan: {
    name: string;
    sourceType: string;
    fileCount: number;
    linesScanned: number;
    createdAt: Date;
    summary: ScanSummary | null;
  };
  findings: Finding[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND_RED = "#ef4444";
const DARK = "#18181b";
const MID = "#52525b";
const LIGHT = "#a1a1aa";
const RULE_LINE = "#e4e4e7";

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#3b82f6",
  INFO: "#71717a",
};

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#3b82f6",
  C: "#eab308",
  D: "#f97316",
  F: "#ef4444",
};

const CATEGORY_LABELS: Record<string, string> = {
  secrets: "Secrets & Credentials",
  auth: "Authentication & Authorisation",
  injection: "Injection",
  cors: "CORS & Headers",
  "data-exposure": "Data Exposure",
  config: "Configuration",
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: DARK,
    backgroundColor: "#ffffff",
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
  },

  // Cover
  coverAccent: {
    backgroundColor: BRAND_RED,
    height: 6,
    width: "100%",
  },
  coverBody: {
    paddingHorizontal: 48,
    paddingTop: 56,
    flex: 1,
  },
  brand: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: BRAND_RED,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 11,
    color: MID,
    marginTop: 4,
    letterSpacing: 1,
  },
  gradeCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 48,
    marginBottom: 24,
  },
  gradeText: {
    fontSize: 48,
    fontFamily: "Helvetica-Bold",
  },
  coverScanName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginBottom: 8,
  },
  coverMeta: {
    fontSize: 10,
    color: MID,
    marginBottom: 4,
  },
  coverDivider: {
    borderBottomWidth: 1,
    borderBottomColor: RULE_LINE,
    marginTop: 36,
    marginBottom: 24,
  },
  coverStats: {
    flexDirection: "row",
    gap: 32,
  },
  coverStatBlock: {
    alignItems: "center",
  },
  coverStatValue: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
  },
  coverStatLabel: {
    fontSize: 8,
    color: LIGHT,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  coverFooter: {
    borderTopWidth: 1,
    borderTopColor: RULE_LINE,
    marginHorizontal: 48,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coverFooterText: {
    fontSize: 8,
    color: LIGHT,
  },

  // Section pages
  pageAccent: {
    backgroundColor: BRAND_RED,
    height: 3,
    width: "100%",
  },
  pageBody: {
    paddingHorizontal: 48,
    paddingTop: 32,
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: RULE_LINE,
  },
  pageTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: DARK,
  },
  pageBrand: {
    fontSize: 9,
    color: LIGHT,
    letterSpacing: 1,
  },

  // Summary table
  table: {
    marginBottom: 24,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: RULE_LINE,
    paddingVertical: 8,
    alignItems: "center",
  },
  tableHeader: {
    backgroundColor: "#f4f4f5",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    flexDirection: "row",
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: MID,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flex: 1,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    color: DARK,
  },
  tableCellBold: {
    flex: 1,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: DARK,
  },

  // Severity pill
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  pillText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Score bar
  scoreBarBg: {
    backgroundColor: "#f4f4f5",
    borderRadius: 4,
    height: 8,
    width: "100%",
    marginBottom: 4,
  },
  scoreBarFill: {
    borderRadius: 4,
    height: 8,
  },

  // Finding card
  findingCard: {
    borderWidth: 1,
    borderColor: RULE_LINE,
    borderRadius: 6,
    marginBottom: 14,
    overflow: "hidden",
  },
  findingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: RULE_LINE,
  },
  findingTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    flex: 1,
  },
  findingBody: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  findingFilePath: {
    fontSize: 8,
    color: MID,
    fontFamily: "Courier",
    marginBottom: 6,
  },
  findingDesc: {
    fontSize: 9,
    color: DARK,
    lineHeight: 1.5,
    marginBottom: 8,
  },
  findingLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: LIGHT,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  findingAI: {
    fontSize: 9,
    color: "#3f3f46",
    lineHeight: 1.5,
    backgroundColor: "#fafafa",
    padding: 8,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: BRAND_RED,
    marginBottom: 8,
  },
  findingFix: {
    fontSize: 8,
    color: DARK,
    fontFamily: "Courier",
    backgroundColor: "#f0fdf4",
    padding: 8,
    borderRadius: 4,
    lineHeight: 1.4,
  },
  findingCode: {
    fontSize: 8,
    color: "#1c1917",
    fontFamily: "Courier",
    backgroundColor: "#fafafa",
    padding: 8,
    borderRadius: 4,
    lineHeight: 1.4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: RULE_LINE,
  },

  // Methodology
  methodBody: {
    paddingHorizontal: 48,
    paddingTop: 32,
  },
  methodTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: RULE_LINE,
  },
  methodText: {
    fontSize: 9,
    color: DARK,
    lineHeight: 1.6,
    marginBottom: 10,
  },
  methodCategoryRow: {
    flexDirection: "row",
    marginBottom: 6,
    alignItems: "flex-start",
    gap: 8,
  },
  methodBullet: {
    fontSize: 9,
    color: BRAND_RED,
    fontFamily: "Helvetica-Bold",
  },
  methodCategoryName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    width: 120,
  },
  methodCategoryDesc: {
    fontSize: 9,
    color: MID,
    flex: 1,
    lineHeight: 1.4,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SeverityPill({ severity }: { severity: string }) {
  return (
    <View style={[s.pill, { backgroundColor: SEV_COLORS[severity] ?? "#71717a" }]}>
      <Text style={s.pillText}>{severity}</Text>
    </View>
  );
}

function PageHeader({ title }: { title: string }) {
  return (
    <View style={s.pageHeader}>
      <Text style={s.pageTitle}>{title}</Text>
      <Text style={s.pageBrand}>VIBESCAN</Text>
    </View>
  );
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function shortPath(filePath: string) {
  const parts = filePath.split("/");
  if (parts.length <= 3) return filePath;
  return "…/" + parts.slice(-3).join("/");
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

function CoverPage({ scan }: { scan: ScanReportProps["scan"] }) {
  const summary = scan.summary;
  const grade = summary?.grade ?? "?";
  const riskScore = Math.round(summary?.riskScore ?? 0);
  const gradeColor = GRADE_COLORS[grade] ?? "#71717a";
  const scoreColor =
    riskScore >= 80 ? "#22c55e" : riskScore >= 60 ? "#eab308" : "#ef4444";

  return (
    <Page size="A4" style={s.page}>
      <View style={s.coverAccent} />
      <View style={s.coverBody}>
        <Text style={s.brand}>VibeScan</Text>
        <Text style={s.tagline}>AI Code Security Report</Text>

        <View style={[s.gradeCircle, { borderColor: gradeColor }]}>
          <Text style={[s.gradeText, { color: gradeColor }]}>{grade}</Text>
        </View>

        <Text style={s.coverScanName}>{scan.name}</Text>
        <Text style={s.coverMeta}>
          {scan.fileCount} file{scan.fileCount !== 1 ? "s" : ""} ·{" "}
          {scan.linesScanned.toLocaleString()} lines scanned ·{" "}
          {scan.sourceType.toLowerCase()}
        </Text>
        <Text style={s.coverMeta}>
          {new Date(scan.createdAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </Text>

        {/* Score bar */}
        <View style={{ marginTop: 20, marginBottom: 8 }}>
          <Text style={{ fontSize: 9, color: MID, marginBottom: 4 }}>
            Risk Score: {riskScore}/100
          </Text>
          <View style={s.scoreBarBg}>
            <View
              style={[
                s.scoreBarFill,
                { width: `${riskScore}%`, backgroundColor: scoreColor },
              ]}
            />
          </View>
        </View>

        <View style={s.coverDivider} />

        {/* Severity counts */}
        <View style={s.coverStats}>
          {[
            { label: "Critical", count: summary?.criticalCount ?? 0, color: SEV_COLORS.CRITICAL },
            { label: "High", count: summary?.highCount ?? 0, color: SEV_COLORS.HIGH },
            { label: "Medium", count: summary?.mediumCount ?? 0, color: SEV_COLORS.MEDIUM },
            { label: "Low", count: summary?.lowCount ?? 0, color: SEV_COLORS.LOW },
          ].map(({ label, count, color }) => (
            <View key={label} style={s.coverStatBlock}>
              <Text style={[s.coverStatValue, { color }]}>{count}</Text>
              <Text style={s.coverStatLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.coverFooter}>
        <Text style={s.coverFooterText}>Confidential — for authorized use only</Text>
        <Text style={s.coverFooterText}>vibescan.app</Text>
      </View>
    </Page>
  );
}

// ─── Executive Summary Page ───────────────────────────────────────────────────

function SummaryPage({
  scan,
  findings,
}: {
  scan: ScanReportProps["scan"];
  findings: Finding[];
}) {
  const summary = scan.summary;

  // Category breakdown
  const catCounts: Record<string, number> = {};
  for (const f of findings) {
    catCounts[f.category] = (catCounts[f.category] ?? 0) + 1;
  }
  const topCategories = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const criticals = findings.filter((f) => f.severity === "CRITICAL").slice(0, 3);

  return (
    <Page size="A4" style={s.page}>
      <View style={s.pageAccent} />
      <View style={s.pageBody}>
        <PageHeader title="Executive Summary" />

        {/* Severity table */}
        <Text style={[s.findingLabel, { marginBottom: 8 }]}>Findings by Severity</Text>
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={s.tableHeaderText}>Severity</Text>
            <Text style={s.tableHeaderText}>Count</Text>
            <Text style={[s.tableHeaderText, { flex: 2 }]}>Impact</Text>
          </View>
          {[
            { sev: "CRITICAL", count: summary?.criticalCount ?? 0, impact: "Immediate exploitation risk. Fix before next deploy." },
            { sev: "HIGH", count: summary?.highCount ?? 0, impact: "Significant exposure. Fix within current sprint." },
            { sev: "MEDIUM", count: summary?.mediumCount ?? 0, impact: "Moderate risk. Schedule for near-term remediation." },
            { sev: "LOW", count: summary?.lowCount ?? 0, impact: "Minor risk. Address in regular maintenance." },
          ].map(({ sev, count, impact }) => (
            <View key={sev} style={s.tableRow}>
              <View style={{ flex: 1 }}>
                <SeverityPill severity={sev} />
              </View>
              <Text style={[s.tableCellBold, { color: SEV_COLORS[sev] }]}>{count}</Text>
              <Text style={[s.tableCell, { flex: 2 }]}>{impact}</Text>
            </View>
          ))}
        </View>

        {/* Category breakdown */}
        {topCategories.length > 0 && (
          <>
            <Text style={[s.findingLabel, { marginBottom: 8 }]}>Findings by Category</Text>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderText, { flex: 2 }]}>Category</Text>
                <Text style={s.tableHeaderText}>Count</Text>
              </View>
              {topCategories.map(([cat, count]) => (
                <View key={cat} style={s.tableRow}>
                  <Text style={[s.tableCell, { flex: 2 }]}>
                    {CATEGORY_LABELS[cat] ?? cat}
                  </Text>
                  <Text style={s.tableCellBold}>{count}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Top critical findings */}
        {criticals.length > 0 && (
          <>
            <Text style={[s.findingLabel, { marginBottom: 8 }]}>
              Top Critical Findings
            </Text>
            {criticals.map((f) => (
              <View key={f.id} style={{ marginBottom: 8, paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: BRAND_RED }}>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 2 }}>
                  {f.title}
                </Text>
                <Text style={{ fontSize: 8, color: MID, fontFamily: "Courier", marginBottom: 3 }}>
                  {shortPath(f.filePath)}{f.lineNumber ? `:${f.lineNumber}` : ""}
                </Text>
                <Text style={{ fontSize: 9, color: MID, lineHeight: 1.4 }}>
                  {truncate(f.description, 200)}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>
    </Page>
  );
}

// ─── Finding Card ─────────────────────────────────────────────────────────────

function FindingCard({ finding }: { finding: Finding }) {
  const fix = finding.fixSuggestion ?? finding.fixTemplate;

  return (
    <View style={s.findingCard} wrap={false}>
      <View style={s.findingHeader}>
        <SeverityPill severity={finding.severity} />
        <Text style={s.findingTitle}>{finding.title}</Text>
        <Text style={{ fontSize: 8, color: LIGHT, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {finding.category}
        </Text>
      </View>
      <View style={s.findingBody}>
        <Text style={s.findingFilePath}>
          {shortPath(finding.filePath)}
          {finding.lineNumber ? `:${finding.lineNumber}` : ""}
        </Text>

        {finding.codeSnippet && (
          <Text style={s.findingCode}>{truncate(finding.codeSnippet, 400)}</Text>
        )}

        <Text style={s.findingDesc}>{finding.description}</Text>

        {finding.aiExplanation && (
          <>
            <Text style={s.findingLabel}>Expert Analysis</Text>
            <Text style={s.findingAI}>{truncate(finding.aiExplanation, 600)}</Text>
          </>
        )}

        {fix && (
          <>
            <Text style={s.findingLabel}>Recommended Fix</Text>
            <Text style={s.findingFix}>{truncate(fix, 400)}</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Findings Pages ───────────────────────────────────────────────────────────

function FindingsPage({ findings, title }: { findings: Finding[]; title: string }) {
  if (findings.length === 0) return null;
  return (
    <Page size="A4" style={s.page}>
      <View style={s.pageAccent} />
      <View style={s.pageBody}>
        <PageHeader title={title} />
        {findings.map((f) => (
          <FindingCard key={f.id} finding={f} />
        ))}
      </View>
    </Page>
  );
}

// ─── Methodology Page ─────────────────────────────────────────────────────────

function MethodologyPage() {
  const categories = [
    { name: "Secrets & Credentials", desc: "Hardcoded API keys, passwords, tokens, and exposed .env files" },
    { name: "Authentication", desc: "Missing auth checks, JWT decode without verify, default credentials" },
    { name: "Injection", desc: "SQL injection, NoSQL injection, XSS via dangerouslySetInnerHTML, eval(), command injection" },
    { name: "CORS & Headers", desc: "Wildcard origins, credentials with wildcard, missing security headers, rate limiting" },
    { name: "Data Exposure", desc: "Full error stacks sent to client, sensitive console.log, unfiltered SELECT *" },
    { name: "Configuration", desc: "Missing input validation, open redirects, insecure cookie flags, debug mode in production" },
  ];

  return (
    <Page size="A4" style={s.page}>
      <View style={s.pageAccent} />
      <View style={s.methodBody}>
        <Text style={s.methodTitle}>Methodology</Text>
        <Text style={s.methodText}>
          VibeScan analyses source code using a dual-layer engine: regex pattern matching for
          known vulnerability signatures, and structural heuristics (AST-equivalent) for
          context-aware detection. Rules are specifically calibrated for patterns introduced by
          AI coding tools including GitHub Copilot, Cursor, Claude Code, Lovable, and Bolt.
        </Text>
        <Text style={s.methodText}>
          The scanner covers 26 rules across 6 categories. CRITICAL and HIGH findings receive
          GPT-4.1 powered analysis from a principal security engineer persona — identifying the
          exact attack vector, blast radius, and remediation steps specific to the flagged code.
        </Text>
        <Text style={[s.methodText, { marginBottom: 12 }]}>Detection categories:</Text>
        {categories.map(({ name, desc }) => (
          <View key={name} style={s.methodCategoryRow}>
            <Text style={s.methodBullet}>▸</Text>
            <Text style={s.methodCategoryName}>{name}</Text>
            <Text style={s.methodCategoryDesc}>{desc}</Text>
          </View>
        ))}
        <Text style={[s.methodText, { marginTop: 16, color: MID }]}>
          False positive reduction: test files, comment lines, public API paths, and projects
          with middleware-level authentication are automatically excluded or downgraded.
          Risk score is a weighted severity sum (Critical: 25pts, High: 10pts, Medium: 4pts,
          Low: 1pt) capped at 100. Grade A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 40, F below 40.
        </Text>
      </View>
    </Page>
  );
}

// ─── Main Document ────────────────────────────────────────────────────────────

export function ScanReport({ scan, findings }: ScanReportProps) {
  const criticals = findings.filter((f) => f.severity === "CRITICAL");
  const highs = findings.filter((f) => f.severity === "HIGH");
  const mediumsAndBelow = findings.filter(
    (f) => f.severity !== "CRITICAL" && f.severity !== "HIGH"
  );

  return (
    <Document
      title={`VibeScan Report — ${scan.name}`}
      author="VibeScan"
      subject="Security Vulnerability Report"
    >
      <CoverPage scan={scan} />
      <SummaryPage scan={scan} findings={findings} />
      {criticals.length > 0 && (
        <FindingsPage findings={criticals} title={`Critical Findings (${criticals.length})`} />
      )}
      {highs.length > 0 && (
        <FindingsPage findings={highs} title={`High Severity Findings (${highs.length})`} />
      )}
      {mediumsAndBelow.length > 0 && (
        <FindingsPage
          findings={mediumsAndBelow}
          title={`Medium / Low Findings (${mediumsAndBelow.length})`}
        />
      )}
      <MethodologyPage />
    </Document>
  );
}
