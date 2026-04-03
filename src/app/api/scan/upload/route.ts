import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { bypassesRateLimit } from "@/lib/super-admin";
import { scoreFindings } from "@/lib/engine/scorer";
import { isScannablePath, scanFiles, type FileEntry } from "@/lib/engine/scan-files";
import JSZip from "jszip";

export const maxDuration = 60; // Vercel max for hobby plan

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
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

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const projectName = (formData.get("name") as string | null)?.trim() || file.name.replace(/\.(zip|tar\.gz)$/, "");

  const scan = await prisma.scan.create({
    data: {
      name: projectName,
      sourceType: "UPLOAD",
      sourceRef: file.name,
      status: "SCANNING",
      createdById: session.user.id,
    },
  });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const files = await extractZip(buffer);

    if (files.length === 0) {
      await prisma.scan.update({ where: { id: scan.id }, data: { status: "FAILED" } });
      return NextResponse.json({ error: "No scannable files found in archive" }, { status: 422 });
    }

    const startedAt = Date.now();
    const { allFindings, linesScanned, fileCount } = await scanFiles(files);
    const result = scoreFindings(allFindings, linesScanned);
    const durationMs = Date.now() - startedAt;

    await prisma.$transaction([
      prisma.finding.createMany({
        data: result.findings.map((f) => ({
          scanId: scan.id,
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
        })),
      }),
      prisma.scanSummary.create({
        data: {
          scanId: scan.id,
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
        where: { id: scan.id },
        data: {
          status: "COMPLETE",
          linesScanned,
          fileCount,
          scanDurationMs: durationMs,
          completedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({ scanId: scan.id, ...result });
  } catch (err) {
    await prisma.scan.update({ where: { id: scan.id }, data: { status: "FAILED" } });
    console.error("[scan/upload]", err);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}

async function extractZip(buffer: Buffer): Promise<FileEntry[]> {
  const files: FileEntry[] = [];
  const zip = await JSZip.loadAsync(buffer);

  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;

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
