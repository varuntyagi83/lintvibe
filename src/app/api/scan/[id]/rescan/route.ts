import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { bypassesRateLimit } from "@/lib/super-admin";
import { getGitHubToken, downloadRepoZip } from "@/lib/github";
import { scoreFindings } from "@/lib/engine/scorer";
import { isScannablePath, scanFiles, type FileEntry } from "@/lib/engine/scan-files";
import JSZip from "jszip";

export const maxDuration = 60;

const MAX_ZIP_SIZE = 100 * 1024 * 1024; // 100 MB

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, retryAfter } = checkRateLimit(session.user.id, 10, 60 * 60 * 1000, bypassesRateLimit(session.user.email));
  if (!allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${Math.ceil((retryAfter ?? 60000) / 60000)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfter ?? 60000) / 1000)) } }
    );
  }

  const { id } = await params;

  const scan = await prisma.scan.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      sourceType: true,
      sourceRef: true,
      status: true,
      createdById: true,
    },
  });

  if (!scan || scan.createdById !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Enforce free tier monthly scan quota
  const tier = session.user.tier ?? "FREE";
  if (tier !== "PRO") {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthlyCount = await prisma.scan.count({
      where: { createdById: session.user.id, createdAt: { gte: monthStart } },
    });
    if (monthlyCount >= 10) {
      return NextResponse.json(
        { error: "Free tier limit reached (10 scans/month). Upgrade to Pro for unlimited scans." },
        { status: 402 }
      );
    }
  }

  if (scan.sourceType !== "GITHUB" || !scan.sourceRef) {
    return NextResponse.json(
      { error: "Re-scan is only available for GitHub scans" },
      { status: 400 }
    );
  }

  if (scan.status !== "COMPLETE" && scan.status !== "FAILED") {
    return NextResponse.json(
      { error: "Scan must be complete or failed to re-scan" },
      { status: 400 }
    );
  }

  // Parse sourceRef: https://github.com/owner/repo/tree/branch
  const match = scan.sourceRef.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/(.+)$/
  );
  if (!match) {
    return NextResponse.json(
      { error: "Could not parse GitHub source reference" },
      { status: 400 }
    );
  }
  const [, owner, repo, branch] = match;

  const token = await getGitHubToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
  }

  const orgId = (session.user as { orgId?: string }).orgId ?? null;

  const safeName = scan.name.replace(/[<>"'&\x00-\x1f]/g, "").slice(0, 96);
  const newScan = await prisma.scan.create({
    data: {
      name: `${safeName} (re-scan)`,
      sourceType: "GITHUB",
      sourceRef: scan.sourceRef,
      status: "SCANNING",
      createdById: session.user.id,
      orgId,
    },
  });

  try {
    const buffer = await downloadRepoZip(token, owner, repo, branch);

    if (buffer.length > MAX_ZIP_SIZE) {
      await prisma.scan.update({
        where: { id: newScan.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { error: "Repository too large (max 100 MB)" },
        { status: 413 }
      );
    }

    const files = await extractRepoZip(buffer);

    if (files.length === 0) {
      await prisma.scan.update({
        where: { id: newScan.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { error: "No scannable files found in repository" },
        { status: 422 }
      );
    }

    const startedAt = Date.now();
    const { allFindings, linesScanned, fileCount } = await scanFiles(files);
    const result = scoreFindings(allFindings, linesScanned);
    const durationMs = Date.now() - startedAt;

    await prisma.$transaction([
      prisma.finding.createMany({
        data: result.findings.map((f) => ({
          scanId: newScan.id,
          filePath: f.filePath,
          lineNumber: f.lineNumber,
          lineEnd: f.lineEnd,
          codeSnippet: f.codeSnippet,
          ruleId: f.ruleId,
          severity: f.severity as never,
          category: f.category,
          title: f.title,
          description: f.description,
          fixSuggestion: f.fixTemplate,
          riskCategories: f.riskCategories ?? [],
        })),
      }),
      prisma.scanSummary.create({
        data: {
          scanId: newScan.id,
          totalFindings: result.totalFindings,
          criticalCount: result.criticalCount,
          highCount: result.highCount,
          mediumCount: result.mediumCount,
          lowCount: result.lowCount,
          infoCount: result.infoCount,
          topCategories: result.topCategories,
          riskScore: result.riskScore,
          grade: result.grade,
        },
      }),
      prisma.scan.update({
        where: { id: newScan.id },
        data: {
          status: "COMPLETE",
          linesScanned,
          fileCount,
          scanDurationMs: durationMs,
          completedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({ scanId: newScan.id });
  } catch (err) {
    await prisma.scan.update({
      where: { id: newScan.id },
      data: { status: "FAILED" },
    });
    console.error("[scan/rescan]", err);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}

async function extractRepoZip(buffer: Buffer): Promise<FileEntry[]> {
  const files: FileEntry[] = [];
  const zip = await JSZip.loadAsync(buffer);

  // GitHub zips nest everything under a root dir like `owner-repo-sha/`
  // Detect and strip that prefix
  let rootPrefix = "";
  for (const [zipPath, entry] of Object.entries(zip.files)) {
    if (!entry.dir) continue;
    const parts = zipPath.replace(/\/$/, "").split("/");
    if (parts.length === 1) {
      rootPrefix = parts[0] + "/";
      break;
    }
  }

  for (const [zipPath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;

    const relativePath =
      rootPrefix && zipPath.startsWith(rootPrefix)
        ? zipPath.slice(rootPrefix.length)
        : zipPath;

    const language = isScannablePath(relativePath);
    if (!language) continue;

    try {
      const content = await zipEntry.async("string");
      files.push({ path: relativePath, content, language });
    } catch {
      // Skip unreadable files
    }
  }

  return files;
}
