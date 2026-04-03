"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  falsePositive: boolean;
  fixed: boolean;
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: "text-red-400", bg: "bg-red-950", border: "border-red-800" },
  HIGH: { color: "text-orange-400", bg: "bg-orange-950", border: "border-orange-800" },
  MEDIUM: { color: "text-yellow-400", bg: "bg-yellow-950", border: "border-yellow-800" },
  LOW: { color: "text-blue-400", bg: "bg-blue-950", border: "border-blue-800" },
  INFO: { color: "text-zinc-400", bg: "bg-zinc-800", border: "border-zinc-700" },
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

function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-zinc-900/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <SeverityBadge severity={finding.severity} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{finding.title}</p>
          <p className="text-zinc-500 text-xs mt-0.5">
            {finding.filePath.split("/").pop()} · Line {finding.lineNumber ?? "?"} · {finding.category}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
        )}
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

          <p className="text-zinc-300 text-sm">{finding.description}</p>

          {finding.fixSuggestion && (
            <div className="bg-green-950/30 border border-green-900 rounded p-3">
              <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-1">Fix</p>
              <p className="text-green-300 text-sm">{finding.fixSuggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScanResultsClient({ findings }: { findings: Finding[] }) {
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const filtered = activeFile
    ? findings.filter((f) => f.filePath === activeFile)
    : findings;

  const grouped = SEV_ORDER.map((sev) => ({
    sev,
    items: filtered.filter((f) => f.severity === sev),
  })).filter(({ items }) => items.length > 0);

  return (
    <div className="space-y-6">
      {grouped.map(({ sev, items }) => (
        <div key={sev}>
          <div className="flex items-center gap-2 mb-3">
            <SeverityBadge severity={sev} />
            <span className="text-zinc-400 text-sm">
              {items.length} finding{items.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {items.map((f) => (
              <FindingCard key={f.id} finding={f} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
