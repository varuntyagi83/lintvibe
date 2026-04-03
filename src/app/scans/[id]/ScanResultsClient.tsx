"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown, ChevronUp, Sparkles, Loader2, Lock,
  Brain, CheckCircle2, EyeOff, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Finding {
  id: string;
  filePath: string;
  lineNumber: number | null;
  codeSnippet: string | null;
  ruleId: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  fixSuggestion: string | null;
  aiExplanation: string | null;
  falsePositive: boolean;
  fixed: boolean;
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: "text-red-400",    bg: "bg-red-950",    border: "border-red-800" },
  HIGH:     { color: "text-orange-400", bg: "bg-orange-950", border: "border-orange-800" },
  MEDIUM:   { color: "text-yellow-400", bg: "bg-yellow-950", border: "border-yellow-800" },
  LOW:      { color: "text-blue-400",   bg: "bg-blue-950",   border: "border-blue-800" },
  INFO:     { color: "text-zinc-400",   bg: "bg-zinc-800",   border: "border-zinc-700" },
};

const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity];
  if (!cfg) return null;
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-semibold ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
      {severity.charAt(0) + severity.slice(1).toLowerCase()}
    </span>
  );
}

function FindingCard({
  finding,
  onToggleFP,
  onToggleFixed,
}: {
  finding: Finding;
  onToggleFP: (id: string) => Promise<void>;
  onToggleFixed: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fpPending, setFpPending] = useState(false);
  const [fixedPending, setFixedPending] = useState(false);

  const isAiDetected = finding.ruleId === "ai-detected";
  const isMuted = finding.falsePositive || finding.fixed;

  async function handleFP() {
    setFpPending(true);
    await onToggleFP(finding.id);
    setFpPending(false);
  }

  async function handleFixed() {
    setFixedPending(true);
    await onToggleFixed(finding.id);
    setFixedPending(false);
  }

  return (
    <div className={`border rounded-lg overflow-hidden transition-opacity ${
      isMuted ? "border-zinc-800/50 opacity-50" : "border-zinc-800"
    }`}>
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-zinc-900/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <SeverityBadge severity={finding.severity} />
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${finding.fixed ? "line-through text-zinc-500" : ""}`}>
            {finding.title}
          </p>
          <p className="text-zinc-500 text-xs mt-0.5">
            {finding.filePath === "paste" ? "paste" : (() => {
              const p = finding.filePath.split("/");
              return p.length > 1 ? p.slice(-2).join("/") : finding.filePath;
            })()}
            {" "}· Line {finding.lineNumber ?? "?"} · {finding.category}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isAiDetected && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-400 text-xs font-medium">
              <Brain className="h-2.5 w-2.5" />
              AI
            </span>
          )}
          {finding.fixed && (
            <span className="text-green-500 text-xs font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Fixed
            </span>
          )}
          {finding.falsePositive && (
            <span className="text-zinc-500 text-xs">False positive</span>
          )}
          {finding.aiExplanation && !isAiDetected && (
            <Sparkles className="h-3.5 w-3.5 text-purple-400" aria-label="AI-analysed" />
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-zinc-500 mt-0.5" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500 mt-0.5" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 p-4 space-y-4">
          {finding.filePath !== "paste" && (
            <p className="text-zinc-500 text-xs font-mono">{finding.filePath}</p>
          )}

          {finding.codeSnippet && (
            <pre className="bg-zinc-950 border border-zinc-800 rounded p-3 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap">
              {finding.codeSnippet}
            </pre>
          )}

          {finding.aiExplanation ? (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-purple-400 text-xs font-semibold uppercase tracking-wider">
                {isAiDetected ? <Brain className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                {isAiDetected ? "AI Deep Scan Analysis" : "AI Analysis"}
              </div>
              <div className="text-zinc-300 text-sm whitespace-pre-line">
                {finding.aiExplanation}
              </div>
            </div>
          ) : (
            <p className="text-zinc-300 text-sm">{finding.description}</p>
          )}

          {finding.fixSuggestion && (
            <div className="bg-green-950/30 border border-green-900 rounded p-3">
              <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-2">
                {finding.aiExplanation ? "AI-generated fix" : "Fix suggestion"}
              </p>
              <pre className="text-green-300 text-xs font-mono whitespace-pre-wrap">
                {finding.fixSuggestion}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1 border-t border-zinc-800/50">
            <button
              onClick={handleFixed}
              disabled={fixedPending || finding.falsePositive}
              className={`flex items-center gap-1.5 text-xs transition-colors disabled:opacity-40 ${
                finding.fixed
                  ? "text-green-400 hover:text-zinc-400"
                  : "text-zinc-500 hover:text-green-400"
              }`}
            >
              {fixedPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                finding.fixed ? <RotateCcw className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />
              )}
              {finding.fixed ? "Unmark fixed" : "Mark as fixed"}
            </button>

            <button
              onClick={handleFP}
              disabled={fpPending || finding.fixed}
              className={`flex items-center gap-1.5 text-xs transition-colors disabled:opacity-40 ${
                finding.falsePositive
                  ? "text-zinc-400 hover:text-zinc-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {fpPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
              {finding.falsePositive ? "Restore" : "False positive"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScanResultsClient({
  findings: initialFindings,
  scanId,
  hasUnexplained,
  sourceType,
  isAdmin,
}: {
  findings: Finding[];
  scanId: string;
  hasUnexplained: boolean;
  sourceType: string;
  isAdmin: boolean;
}) {
  const [findings, setFindings] = useState(initialFindings);
  const [analysing, startAnalysis] = useTransition();
  const [deepScanning, startDeepScan] = useTransition();
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [deepStatus, setDeepStatus] = useState<string | null>(null);
  const [showFP, setShowFP] = useState(false);

  const hasDeepScan = findings.some((f) => f.ruleId === "ai-detected");
  const isGitHub = sourceType === "GITHUB";

  async function handleAIAnalysis() {
    setAnalysisStatus(null);
    startAnalysis(async () => {
      const res = await fetch(`/api/scan/${scanId}/ai-explain`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setAnalysisStatus(data.error ?? "Analysis failed"); return; }

      const updated = await fetch(`/api/scan/${scanId}/findings`);
      if (updated.ok) {
        const { findings: fresh } = await updated.json();
        setFindings(fresh);
      }
      setAnalysisStatus(
        data.limited
          ? `Analysed 3 findings (free tier limit). Upgrade to Pro to analyse all.`
          : `Analysed ${data.enriched} finding${data.enriched !== 1 ? "s" : ""} with AI.`
      );
    });
  }

  async function handleDeepScan() {
    setDeepStatus(null);
    startDeepScan(async () => {
      const res = await fetch(`/api/scan/${scanId}/ai-deepscan`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setDeepStatus(data.error ?? "Deep scan failed"); return; }

      const updated = await fetch(`/api/scan/${scanId}/findings`);
      if (updated.ok) {
        const { findings: fresh } = await updated.json();
        setFindings(fresh);
      }
      setDeepStatus(
        data.found === 0
          ? "No additional issues found beyond the rule-based scan."
          : `Found ${data.found} additional issue${data.found !== 1 ? "s" : ""} missed by static analysis.`
      );
    });
  }

  async function toggleFP(id: string) {
    const finding = findings.find((f) => f.id === id);
    if (!finding) return;
    const res = await fetch(`/api/finding/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ falsePositive: !finding.falsePositive }),
    });
    if (res.ok) {
      setFindings((prev) =>
        prev.map((f) => f.id === id ? { ...f, falsePositive: !f.falsePositive, fixed: false } : f)
      );
    }
  }

  async function toggleFixed(id: string) {
    const finding = findings.find((f) => f.id === id);
    if (!finding) return;
    const res = await fetch(`/api/finding/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixed: !finding.fixed }),
    });
    if (res.ok) {
      setFindings((prev) =>
        prev.map((f) => f.id === id ? { ...f, fixed: !f.fixed, falsePositive: false } : f)
      );
    }
  }

  const activeFindings = findings.filter((f) => !f.falsePositive);
  const fpFindings = findings.filter((f) => f.falsePositive);

  const grouped = SEV_ORDER.map((sev) => ({
    sev,
    items: activeFindings.filter((f) => f.severity === sev),
  })).filter(({ items }) => items.length > 0);

  const criticalOrHigh = activeFindings.filter(
    (f) => f.severity === "CRITICAL" || f.severity === "HIGH"
  );
  const fixedCount = activeFindings.filter((f) => f.fixed).length;

  return (
    <div className="space-y-5">
      {/* Layer 3 — AI Analysis banner */}
      {criticalOrHigh.length > 0 && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-purple-900 bg-purple-950/20">
          <div>
            <p className="text-sm font-medium text-purple-300">AI Expert Analysis</p>
            <p className="text-xs text-purple-500 mt-0.5">
              {hasUnexplained
                ? `Explain attack vectors and generate fixes for your ${criticalOrHigh.length} critical/high findings`
                : "All critical/high findings have been analysed"}
            </p>
          </div>
          {hasUnexplained ? (
            <Button onClick={handleAIAnalysis} disabled={analysing} className="bg-purple-700 hover:bg-purple-600 shrink-0 text-sm">
              {analysing ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analysing…</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Analyse with AI</>}
            </Button>
          ) : (
            <span className="flex items-center gap-1.5 text-purple-400 text-xs"><Sparkles className="h-3.5 w-3.5" />Complete</span>
          )}
        </div>
      )}

      {/* Layer 2 — AI Deep Scan banner */}
      {isAdmin && isGitHub && !hasDeepScan && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-indigo-900 bg-indigo-950/20">
          <div>
            <p className="text-sm font-medium text-indigo-300 flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" />
              AI Deep Scan
            </p>
            <p className="text-xs text-indigo-500 mt-0.5">
              Find IDOR, mass assignment, broken access control, and logic flaws the rules engine can&apos;t catch
            </p>
          </div>
          <Button onClick={handleDeepScan} disabled={deepScanning} className="bg-indigo-700 hover:bg-indigo-600 shrink-0 text-sm">
            {deepScanning ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Scanning…</> : <><Brain className="h-3.5 w-3.5 mr-1.5" />Deep Scan</>}
          </Button>
        </div>
      )}
      {hasDeepScan && (
        <div className="flex items-center gap-2 text-xs text-indigo-400">
          <Brain className="h-3.5 w-3.5" />
          AI Deep Scan complete — AI-detected findings are marked with the AI badge
        </div>
      )}

      {/* Status messages */}
      {analysisStatus && (
        <p className="text-sm text-zinc-400 flex items-center gap-1.5">
          {analysisStatus.includes("limit") && <Lock className="h-3.5 w-3.5 text-yellow-400" />}
          {analysisStatus}
        </p>
      )}
      {deepStatus && (
        <p className="text-sm text-zinc-400 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-indigo-400" />
          {deepStatus}
        </p>
      )}

      {/* Progress bar */}
      {fixedCount > 0 && (
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${Math.round((fixedCount / activeFindings.length) * 100)}%` }}
            />
          </div>
          {fixedCount}/{activeFindings.length} fixed
        </div>
      )}

      {/* Findings grouped by severity */}
      {grouped.map(({ sev, items }) => (
        <div key={sev}>
          <div className="flex items-center gap-2 mb-3">
            <SeverityBadge severity={sev} />
            <span className="text-zinc-400 text-sm">{items.length} finding{items.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {items.map((f) => (
              <FindingCard key={f.id} finding={f} onToggleFP={toggleFP} onToggleFixed={toggleFixed} />
            ))}
          </div>
        </div>
      ))}

      {/* False positives */}
      {fpFindings.length > 0 && (
        <div>
          <button
            onClick={() => setShowFP((v) => !v)}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1.5"
          >
            <EyeOff className="h-3 w-3" />
            {fpFindings.length} hidden false positive{fpFindings.length !== 1 ? "s" : ""}
            {showFP ? " (click to hide)" : " (click to show)"}
          </button>
          {showFP && (
            <div className="space-y-2 mt-2">
              {fpFindings.map((f) => (
                <FindingCard key={f.id} finding={f} onToggleFP={toggleFP} onToggleFixed={toggleFixed} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
