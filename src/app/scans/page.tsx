import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, ArrowLeft, CheckCircle, Clock, AlertTriangle, GitCompareArrows } from "lucide-react";
import { Suspense } from "react";
import ScanFilters from "./ScanFilters";
import DeleteScanButton from "./DeleteScanButton";

function GradeBadge({ grade }: { grade: string | null | undefined }) {
  const colors: Record<string, string> = {
    A: "bg-green-950 border-green-700 text-green-400",
    B: "bg-blue-950 border-blue-700 text-blue-400",
    C: "bg-yellow-950 border-yellow-700 text-yellow-400",
    D: "bg-orange-950 border-orange-700 text-orange-400",
    F: "bg-red-950 border-red-700 text-red-400",
  };
  const g = grade ?? "?";
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border font-bold text-sm ${colors[g] ?? "bg-zinc-800 border-zinc-600 text-zinc-400"}`}>
      {g}
    </span>
  );
}

function RiskBar({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-red-500" : score >= 40 ? "bg-orange-500" : score >= 20 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs text-zinc-400">{Math.round(score)}</span>
    </div>
  );
}

type SearchParams = Promise<{ source?: string; grade?: string; sort?: string }>;

export default async function ScansPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { source, grade, sort } = await searchParams;
  const userId = session.user.id;

  const where = {
    createdById: userId,
    ...(source && source !== "all" ? { sourceType: source.toUpperCase() as never } : {}),
    ...(grade && grade !== "all" ? { summary: { grade } } : {}),
  };

  const orderBy =
    sort === "findings"
      ? { summary: { totalFindings: "desc" as const } }
      : sort === "score"
      ? { summary: { riskScore: "desc" as const } }
      : sort === "grade"
      ? { summary: { grade: "asc" as const } }
      : { createdAt: "desc" as const };

  const scans = await prisma.scan.findMany({
    where,
    orderBy,
    include: { summary: true },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-500" />
          <span className="font-bold tracking-tight">VibeScan</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <span>{session.user.email}</span>
          <Link href="/api/auth/signout" className="hover:text-zinc-200 transition-colors">
            Sign out
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm mb-2 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold">All scans</h1>
          </div>
          {scans.length >= 2 && (
            <Link
              href="/scans/compare"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors"
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              Compare scans
            </Link>
          )}
        </div>

        {/* Filters — wrapped in Suspense because it reads useSearchParams */}
        <Suspense>
          <ScanFilters />
        </Suspense>

        {scans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-zinc-800 rounded-xl">
            <Shield className="h-8 w-8 text-zinc-700 mb-3" />
            <p className="font-medium text-zinc-400">No scans match these filters</p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Project</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Source</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Grade</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Risk score</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Findings</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => (
                  <tr key={scan.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/scans/${scan.id}`} className="font-medium hover:text-red-400 transition-colors">
                        {scan.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 capitalize text-xs">
                      {scan.sourceType.toLowerCase()}
                    </td>
                    <td className="px-4 py-3">
                      <GradeBadge grade={scan.summary?.grade} />
                    </td>
                    <td className="px-4 py-3">
                      {scan.summary ? (
                        <RiskBar score={scan.summary.riskScore} />
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {scan.summary ? (
                        <div className="text-xs space-y-0.5">
                          <span className="text-zinc-200">{scan.summary.totalFindings} total</span>
                          {scan.summary.criticalCount > 0 && (
                            <span className="block text-red-400">{scan.summary.criticalCount} critical</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {scan.status === "COMPLETE" ? (
                        <span className="flex items-center gap-1 text-green-400 text-xs">
                          <CheckCircle className="h-3 w-3" /> Complete
                        </span>
                      ) : scan.status === "SCANNING" ? (
                        <span className="flex items-center gap-1 text-yellow-400 text-xs">
                          <Clock className="h-3 w-3" /> Scanning…
                        </span>
                      ) : scan.status === "FAILED" ? (
                        <span className="flex items-center gap-1 text-red-400 text-xs">
                          <AlertTriangle className="h-3 w-3" /> Failed
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-xs">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {new Date(scan.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteScanButton scanId={scan.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
