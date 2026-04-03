import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, Upload, Code2, AlertTriangle, CheckCircle, Clock, ArrowRight } from "lucide-react";
import GitHubIcon from "@/components/icons/GitHubIcon";
import DashboardCharts from "@/components/dashboard/DashboardCharts";

const btn = "inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-2.5 py-1.5 text-[0.8rem] font-medium transition-colors hover:bg-primary/80";
const btnOutline = "inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-transparent text-zinc-200 px-2.5 py-1.5 text-[0.8rem] font-medium transition-colors hover:bg-zinc-800";

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

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    CRITICAL: "bg-red-500",
    HIGH: "bg-orange-500",
    MEDIUM: "bg-yellow-500",
    LOW: "bg-blue-500",
    INFO: "bg-zinc-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[severity] ?? "bg-zinc-500"}`} />;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;

  const [scans, totalFindings, criticalUnresolved, categoryGroups] = await Promise.all([
    prisma.scan.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { summary: true },
    }),
    prisma.finding.count({
      where: { scan: { createdById: userId }, falsePositive: false },
    }),
    prisma.finding.count({
      where: {
        scan: { createdById: userId },
        severity: "CRITICAL",
        fixed: false,
        falsePositive: false,
      },
    }),
    prisma.finding.groupBy({
      by: ["category"],
      where: { scan: { createdById: userId }, falsePositive: false },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 6,
    }),
  ]);

  const avgRiskScore =
    scans.length > 0
      ? Math.round(
          scans.reduce((sum: number, s: typeof scans[0]) => sum + (s.summary?.riskScore ?? 0), 0) /
            scans.length
        )
      : 0;

  // Chart data — reverse so oldest is leftmost
  const trendData = [...scans]
    .reverse()
    .filter((s) => s.summary)
    .map((s) => ({
      label: s.name.length > 14 ? s.name.slice(0, 14) + "…" : s.name,
      score: Math.round(s.summary!.riskScore),
      grade: s.summary!.grade ?? "?",
    }));

  const categoryData = categoryGroups.map((g) => ({
    category: g.category,
    count: g._count.id,
  }));

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-500" />
          <span className="font-bold tracking-tight">VibeScan</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/scans" className="text-zinc-400 hover:text-zinc-200 transition-colors">
            All scans
          </Link>
          <Link href="/integrations" className="text-zinc-400 hover:text-zinc-200 transition-colors">
            Integrations
          </Link>
          <span className="text-zinc-400">{session.user.email}</span>
          <Link href="/api/auth/signout" className="text-zinc-500 hover:text-zinc-200 transition-colors">
            Sign out
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-2">
            <Link href="/scan/paste" className={btnOutline}>
              <Code2 className="h-3.5 w-3.5 mr-1.5" />
              Paste code
            </Link>
            <Link href="/scan/upload" className={btnOutline}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload
            </Link>
            <Link href="/scan/github" className={btn}>
              <GitHubIcon className="h-3.5 w-3.5 mr-1.5" />
              GitHub repo
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total scans", value: scans.length },
            { label: "Avg risk score", value: avgRiskScore },
            { label: "Total findings", value: totalFindings },
            { label: "Critical (open)", value: criticalUnresolved, danger: criticalUnresolved > 0 },
          ].map(({ label, value, danger }) => (
            <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-zinc-500 text-xs mb-1">{label}</p>
              <p className={`text-2xl font-bold ${danger ? "text-red-400" : ""}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <DashboardCharts trendData={trendData} categoryData={categoryData} />

        {/* Recent scans */}
        {scans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-zinc-800 rounded-xl">
            <Shield className="h-10 w-10 text-zinc-700 mb-4" />
            <h2 className="font-semibold text-lg mb-2">No scans yet</h2>
            <p className="text-zinc-500 text-sm mb-6">
              Paste code or upload a project to run your first scan
            </p>
            <Link href="/scan/paste" className={btn}>
              Scan your first project →
            </Link>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-zinc-400">Recent scans</p>
              <Link
                href="/scans"
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Project</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Source</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Grade</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Findings</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan: typeof scans[0]) => (
                    <tr key={scan.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/scans/${scan.id}`} className="font-medium hover:text-red-400 transition-colors">
                          {scan.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 capitalize">{scan.sourceType.toLowerCase()}</td>
                      <td className="px-4 py-3">
                        <GradeBadge grade={scan.summary?.grade} />
                      </td>
                      <td className="px-4 py-3">
                        {scan.summary ? (
                          <div className="flex items-center gap-2">
                            <span>{scan.summary.totalFindings}</span>
                            {scan.summary.criticalCount > 0 && (
                              <span className="flex items-center gap-1 text-xs text-red-400">
                                <SeverityDot severity="CRITICAL" />
                                {scan.summary.criticalCount}
                              </span>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
