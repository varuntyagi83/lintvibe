import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Shield, ArrowLeft, FileCode, AlertTriangle, ChevronDown } from "lucide-react";
import ScanResultsClient from "./ScanResultsClient";

export default async function ScanResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const scan = await prisma.scan.findUnique({
    where: { id },
    include: {
      summary: true,
      findings: {
        orderBy: [
          { severity: "asc" }, // CRITICAL first (alphabetically C < H < I < L < M)
          { lineNumber: "asc" },
        ],
      },
    },
  });

  if (!scan || scan.createdById !== session.user.id) notFound();

  // Severity sort order
  const SEV_ORDER: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFO: 4,
  };

  const sortedFindings = [...scan.findings].sort(
    (a, b) =>
      (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) ||
      (a.lineNumber ?? 0) - (b.lineNumber ?? 0)
  );

  // Build file tree
  const fileMap = new Map<
    string,
    { count: number; critical: number; high: number }
  >();
  for (const f of sortedFindings) {
    const existing = fileMap.get(f.filePath) ?? { count: 0, critical: 0, high: 0 };
    existing.count++;
    if (f.severity === "CRITICAL") existing.critical++;
    if (f.severity === "HIGH") existing.high++;
    fileMap.set(f.filePath, existing);
  }
  const fileTree = Array.from(fileMap.entries())
    .sort((a, b) => b[1].critical - a[1].critical || b[1].high - a[1].high)
    .map(([path, stats]) => ({ path, ...stats }));

  const grade = scan.summary?.grade ?? "?";
  const riskScore = scan.summary?.riskScore ?? 0;

  const GRADE_COLORS: Record<string, string> = {
    A: "text-green-400 border-green-700 bg-green-950",
    B: "text-blue-400 border-blue-700 bg-blue-950",
    C: "text-yellow-400 border-yellow-700 bg-yellow-950",
    D: "text-orange-400 border-orange-700 bg-orange-950",
    F: "text-red-400 border-red-700 bg-red-950",
  };

  const gradeClass =
    GRADE_COLORS[grade] ?? "text-zinc-400 border-zinc-600 bg-zinc-800";

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

      <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>

        {/* Scan header */}
        <div className="flex flex-wrap items-start gap-4 mb-6">
          <div className={`flex items-center justify-center w-16 h-16 rounded-full border-2 font-bold text-3xl ${gradeClass}`}>
            {grade}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{scan.name}</h1>
            <p className="text-zinc-400 text-sm mt-0.5">
              Risk score {Math.round(riskScore)}/100 ·{" "}
              {scan.fileCount} file{scan.fileCount !== 1 ? "s" : ""} ·{" "}
              {scan.linesScanned.toLocaleString()} lines ·{" "}
              {scan.sourceType.toLowerCase()} ·{" "}
              {new Date(scan.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Severity counts */}
          <div className="flex gap-4">
            {[
              { label: "Critical", count: scan.summary?.criticalCount ?? 0, color: "text-red-400" },
              { label: "High", count: scan.summary?.highCount ?? 0, color: "text-orange-400" },
              { label: "Medium", count: scan.summary?.mediumCount ?? 0, color: "text-yellow-400" },
              { label: "Low", count: scan.summary?.lowCount ?? 0, color: "text-blue-400" },
            ].map(({ label, count, color }) => (
              <div key={label} className="text-center">
                <p className={`text-2xl font-bold ${color}`}>{count}</p>
                <p className="text-zinc-500 text-xs">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {sortedFindings.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center border border-dashed border-zinc-800 rounded-xl">
            <Shield className="h-10 w-10 text-green-500 mb-3" />
            <p className="font-semibold text-green-400 text-lg">No vulnerabilities found</p>
            <p className="text-zinc-500 text-sm mt-1">
              All {scan.fileCount} files passed 26 detection rules
            </p>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* File tree sidebar */}
            {fileTree.length > 1 && (
              <aside className="w-64 shrink-0">
                <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium mb-2">
                  Files with findings
                </p>
                <div className="space-y-1">
                  {fileTree.map(({ path, count, critical, high }) => (
                    <a
                      key={path}
                      href={`#file-${encodeURIComponent(path)}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
                    >
                      <FileCode className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      <span className="text-zinc-300 text-xs truncate flex-1 group-hover:text-zinc-100">
                        {path.split("/").pop()}
                      </span>
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          critical > 0
                            ? "text-red-400"
                            : high > 0
                            ? "text-orange-400"
                            : "text-zinc-500"
                        }`}
                      >
                        {count}
                      </span>
                    </a>
                  ))}
                </div>
              </aside>
            )}

            {/* Findings */}
            <div className="flex-1 min-w-0">
              <ScanResultsClient findings={sortedFindings} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
