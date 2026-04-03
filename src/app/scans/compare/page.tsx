import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingDown, TrendingUp, Minus, ChevronRight } from "lucide-react";
import CompareSelector from "./CompareSelector";
import AppHeader from "@/components/AppHeader";

type SearchParams = Promise<{ a?: string; b?: string }>;

function GradeCircle({ grade, score }: { grade: string | null | undefined; score: number }) {
  const colors: Record<string, string> = {
    A: "text-green-600 dark:text-green-400 border-green-600 dark:border-green-700 bg-green-50 dark:bg-green-950",
    B: "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-700 bg-blue-50 dark:bg-blue-950",
    C: "text-yellow-600 dark:text-yellow-400 border-yellow-600 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950",
    D: "text-orange-600 dark:text-orange-400 border-orange-600 dark:border-orange-700 bg-orange-50 dark:bg-orange-950",
    F: "text-red-600 dark:text-red-400 border-red-600 dark:border-red-700 bg-red-50 dark:bg-red-950",
  };
  const g = grade ?? "?";
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`inline-flex items-center justify-center w-14 h-14 rounded-full border-2 font-bold text-2xl ${colors[g] ?? "text-muted-foreground border-border bg-muted"}`}>
        {g}
      </span>
      <span className="text-muted-foreground text-xs">Score {Math.round(score)}</span>
    </div>
  );
}

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { a: scanAId, b: scanBId } = await searchParams;
  const userId = session.user.id;
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";

  // Always fetch the scan list for the selector
  const allScans = await prisma.scan.findMany({
    where: { createdById: userId, status: "COMPLETE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, summary: { select: { grade: true, riskScore: true } } },
  });

  // If both IDs provided, fetch full data and compute diff
  let diffData = null;
  if (scanAId && scanBId && scanAId !== scanBId) {
    const [scanA, scanB] = await Promise.all([
      prisma.scan.findFirst({
        where: { id: scanAId, createdById: userId },
        include: {
          summary: true,
          findings: { where: { falsePositive: false }, select: { ruleId: true, filePath: true, title: true, severity: true, category: true, lineNumber: true } },
        },
      }),
      prisma.scan.findFirst({
        where: { id: scanBId, createdById: userId },
        include: {
          summary: true,
          findings: { where: { falsePositive: false }, select: { ruleId: true, filePath: true, title: true, severity: true, category: true, lineNumber: true } },
        },
      }),
    ]);

    if (scanA && scanB) {
      type FindingKey = { ruleId: string; filePath: string };
      const key = (f: FindingKey) => `${f.ruleId}::${f.filePath}`;
      const aKeys = new Set(scanA.findings.map(key));
      const bKeys = new Set(scanB.findings.map(key));

      const fixed = scanA.findings.filter((f) => !bKeys.has(key(f)));
      const newFindings = scanB.findings.filter((f) => !aKeys.has(key(f)));
      const persistent = scanB.findings.filter((f) => aKeys.has(key(f)));

      const scoreDelta = (scanB.summary?.riskScore ?? 0) - (scanA.summary?.riskScore ?? 0);

      diffData = { scanA, scanB, fixed, newFindings, persistent, scoreDelta };
    }
  }

  const SEV_COLORS: Record<string, string> = {
    CRITICAL: "text-red-600 dark:text-red-400",
    HIGH: "text-orange-600 dark:text-orange-400",
    MEDIUM: "text-yellow-600 dark:text-yellow-400",
    LOW: "text-blue-600 dark:text-blue-400",
    INFO: "text-muted-foreground",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader email={session.user.email} isAdmin={isAdmin} nav="scans" />

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        <Link
          href="/scans"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All scans
        </Link>

        <h1 className="text-2xl font-bold mb-6">Compare scans</h1>

        {/* Scan selector */}
        <CompareSelector
          scans={allScans.map((s) => ({
            id: s.id,
            name: s.name,
            date: s.createdAt.toISOString(),
            grade: s.summary?.grade ?? null,
          }))}
          selectedA={scanAId ?? null}
          selectedB={scanBId ?? null}
        />

        {/* Diff results */}
        {diffData && (
          <div className="mt-8 space-y-8">
            {/* Header: A vs B */}
            <div className="flex items-center gap-4 p-5 rounded-xl border border-border bg-card">
              <div className="flex-1 text-center">
                <p className="text-muted-foreground text-xs mb-2">Baseline (A)</p>
                <GradeCircle grade={diffData.scanA.summary?.grade} score={diffData.scanA.summary?.riskScore ?? 0} />
                <p className="mt-2 font-medium text-sm truncate">{diffData.scanA.name}</p>
                <p className="text-muted-foreground/70 text-xs">
                  {new Date(diffData.scanA.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex flex-col items-center gap-1 px-4">
                <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
                {diffData.scoreDelta === 0 ? (
                  <span className="flex items-center gap-1 text-muted-foreground text-sm font-medium">
                    <Minus className="h-4 w-4" /> No change
                  </span>
                ) : diffData.scoreDelta > 0 ? (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm font-semibold">
                    <TrendingUp className="h-4 w-4" /> +{Math.round(diffData.scoreDelta)} risk
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-semibold">
                    <TrendingDown className="h-4 w-4" /> {Math.round(diffData.scoreDelta)} risk
                  </span>
                )}
              </div>

              <div className="flex-1 text-center">
                <p className="text-muted-foreground text-xs mb-2">New scan (B)</p>
                <GradeCircle grade={diffData.scanB.summary?.grade} score={diffData.scanB.summary?.riskScore ?? 0} />
                <p className="mt-2 font-medium text-sm truncate">{diffData.scanB.name}</p>
                <p className="text-muted-foreground/70 text-xs">
                  {new Date(diffData.scanB.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Summary chips */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Fixed", count: diffData.fixed.length, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900" },
                { label: "New", count: diffData.newFindings.length, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900" },
                { label: "Persistent", count: diffData.persistent.length, color: "text-foreground", bg: "bg-muted border-border" },
              ].map(({ label, count, color, bg }) => (
                <div key={label} className={`rounded-xl border p-4 text-center ${bg}`}>
                  <p className={`text-2xl font-bold ${color}`}>{count}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{label} findings</p>
                </div>
              ))}
            </div>

            {/* Fixed findings */}
            {diffData.fixed.length > 0 && (
              <FindingGroup
                title="Fixed findings"
                subtitle="Present in A, gone in B"
                badge="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-300 dark:border-green-800"
                findings={diffData.fixed}
                sevColors={SEV_COLORS}
              />
            )}

            {/* New findings */}
            {diffData.newFindings.length > 0 && (
              <FindingGroup
                title="New findings"
                subtitle="Not in A, appeared in B"
                badge="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800"
                findings={diffData.newFindings}
                sevColors={SEV_COLORS}
              />
            )}

            {/* Persistent */}
            {diffData.persistent.length > 0 && (
              <FindingGroup
                title="Persistent findings"
                subtitle="Present in both A and B"
                badge="bg-muted text-muted-foreground border-border"
                findings={diffData.persistent}
                sevColors={SEV_COLORS}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function FindingGroup({
  title,
  subtitle,
  badge,
  findings,
  sevColors,
}: {
  title: string;
  subtitle: string;
  badge: string;
  findings: Array<{ ruleId: string; filePath: string; title: string; severity: string; category: string; lineNumber: number | null }>;
  sevColors: Record<string, string>;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className="font-semibold">{title}</h3>
        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${badge}`}>
          {findings.length}
        </span>
        <span className="text-muted-foreground text-xs">{subtitle}</span>
      </div>
      <div className="space-y-1">
        {findings.slice(0, 20).map((f, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card">
            <span className={`text-xs font-semibold shrink-0 ${sevColors[f.severity] ?? "text-muted-foreground"}`}>
              {f.severity.charAt(0) + f.severity.slice(1).toLowerCase()}
            </span>
            <span className="text-sm text-foreground flex-1 truncate">{f.title}</span>
            <span className="text-muted-foreground/60 text-xs shrink-0 truncate max-w-[160px]">
              {f.filePath === "paste" ? "paste" : f.filePath.split("/").pop()}
              {f.lineNumber ? `:${f.lineNumber}` : ""}
            </span>
          </div>
        ))}
        {findings.length > 20 && (
          <p className="text-muted-foreground/60 text-xs text-center pt-1">
            +{findings.length - 20} more
          </p>
        )}
      </div>
    </div>
  );
}
