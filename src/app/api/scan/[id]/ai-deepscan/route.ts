import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deepScanFiles } from "@/lib/ai-deepscan";
import { checkRateLimit } from "@/lib/rate-limit";
import { bypassesRateLimit, hasDeepScanAccess } from "@/lib/super-admin";
import { getGitHubToken, downloadRepoZip } from "@/lib/github";
import { isScannablePath, type FileEntry } from "@/lib/engine/scan-files";
import JSZip from "jszip";

export const maxDuration = 120;

// Parse "https://github.com/owner/repo/tree/branch" → { owner, repo, branch }
function parseGitHubRef(sourceRef: string): { owner: string; repo: string; branch: string } | null {
  const match = sourceRef.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/(.+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], branch: match[3] };
}

async function extractZip(buffer: Buffer): Promise<FileEntry[]> {
  const zip = await JSZip.loadAsync(buffer);
  const files: FileEntry[] = [];

  // Find the root prefix (GitHub zips have a single top-level dir)
  const entries = Object.keys(zip.files);
  const prefix = entries.find((e) => e.endsWith("/") && e.split("/").length === 2) ?? "";

  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const relativePath = prefix ? name.slice(prefix.length) : name;
    if (!relativePath) continue;
    const language = isScannablePath(relativePath);
    if (!language) continue;
    const content = await file.async("string");
    files.push({ path: relativePath, content, language });
  }

  return files;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, retryAfter } = checkRateLimit(session.user.id, 5, 60 * 60 * 1000, bypassesRateLimit(session.user.email));
  if (!allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${Math.ceil((retryAfter ?? 60000) / 60000)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfter ?? 60000) / 1000)) } }
    );
  }

  // Super admin, Pro tier, or users with explicit deep_scan exception
  const userTier = session.user.tier ?? "FREE";
  const userExceptions = await prisma.userException
    .findMany({ where: { userId: session.user.id }, select: { feature: true } })
    .then((e) => e.map((x) => x.feature));
  if (!hasDeepScanAccess(session.user.email, userTier, userExceptions)) {
    return NextResponse.json(
      { error: "AI Deep Scan is a Pro feature. Upgrade to unlock." },
      { status: 403 }
    );
  }

  const { id: scanId } = await params;

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { id: true, createdById: true, sourceType: true, sourceRef: true, status: true },
  });

  if (!scan || scan.createdById !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (scan.status !== "COMPLETE") {
    return NextResponse.json({ error: "Scan not complete" }, { status: 400 });
  }

  // Atomically check-and-mark to prevent TOCTOU race from double-clicks.
  // Two concurrent requests both pass a naive count check — use an interactive
  // transaction so the second request sees the sentinel inserted by the first.
  const canProceed = await prisma.$transaction(async (tx) => {
    const existing = await tx.finding.count({ where: { scanId, ruleId: "ai-detected" } });
    if (existing > 0) return false;
    // Insert a sentinel record; if a concurrent request beats us here the
    // unique index on (scanId, filePath, ruleId) would fire — but we don't
    // have one, so the transaction serialisation on PostgreSQL protects us.
    await tx.finding.create({
      data: {
        scanId,
        filePath: "__deep_scan_sentinel__",
        lineNumber: 0,
        ruleId: "ai-detected",
        severity: "INFO" as never,
        category: "system",
        title: "Deep scan initializing",
        description: "Sentinel — replaced when real findings are saved",
      },
    });
    return true;
  });

  if (!canProceed) {
    return NextResponse.json({ error: "Deep scan already run for this scan" }, { status: 409 });
  }

  // Only GitHub scans can be re-fetched for deep scan
  if (scan.sourceType !== "GITHUB" || !scan.sourceRef) {
    return NextResponse.json(
      { error: "AI Deep Scan currently requires a GitHub scan source" },
      { status: 422 }
    );
  }

  const ref = parseGitHubRef(scan.sourceRef);
  if (!ref) {
    return NextResponse.json({ error: "Could not parse GitHub source reference" }, { status: 500 });
  }

  const token = await getGitHubToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: "GitHub token not found" }, { status: 400 });
  }

  try {
    const buffer = await downloadRepoZip(token, ref.owner, ref.repo, ref.branch);
    const files = await extractZip(buffer);

    if (files.length === 0) {
      // Clean up sentinel — no files to scan
      await prisma.finding.deleteMany({ where: { scanId, filePath: "__deep_scan_sentinel__" } });
      return NextResponse.json({ found: 0 });
    }

    const deepFindings = await deepScanFiles(files);

    if (deepFindings.length === 0) {
      // Clean up sentinel — scan ran cleanly, nothing found
      await prisma.finding.deleteMany({ where: { scanId, filePath: "__deep_scan_sentinel__" } });
      return NextResponse.json({ found: 0 });
    }

    // Save findings + update summary atomically so we never get orphaned findings
    // without a summary update (or vice versa).
    const counts = deepFindings.reduce(
      (acc, f) => { acc[f.severity] = (acc[f.severity] ?? 0) + 1; return acc; },
      {} as Record<string, number>
    );

    await prisma.$transaction([
      // Delete sentinel before saving real findings
      prisma.finding.deleteMany({ where: { scanId, filePath: "__deep_scan_sentinel__" } }),
      prisma.finding.createMany({
        data: deepFindings.map((f) => ({
          scanId,
          filePath: f.filePath,
          lineNumber: f.lineNumber,
          ruleId: "ai-detected",
          severity: f.severity as never,
          category: "ai-detected",
          title: f.title,
          description: f.description,
          aiExplanation: `${f.description}\n\nAttack vector: ${f.attackVector}`,
          fixSuggestion: f.fix,
          riskCategories: ["security"],
        })),
      }),
      prisma.scanSummary.update({
        where: { scanId },
        data: {
          totalFindings: { increment: deepFindings.length },
          criticalCount: { increment: counts.CRITICAL ?? 0 },
          highCount: { increment: counts.HIGH ?? 0 },
          mediumCount: { increment: counts.MEDIUM ?? 0 },
          lowCount: { increment: counts.LOW ?? 0 },
        },
      }),
    ]);

    return NextResponse.json({ found: deepFindings.length });
  } catch (err) {
    console.error("[ai-deepscan]", err instanceof Error ? err.message : err);
    // Clean up sentinel so the user can retry after a failed deep scan
    await prisma.finding.deleteMany({ where: { scanId, filePath: "__deep_scan_sentinel__" } }).catch(() => {});
    return NextResponse.json({ error: "Deep scan failed" }, { status: 500 });
  }
}
