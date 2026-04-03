import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scanCode } from "@/lib/engine";
import type { Language } from "@/lib/engine";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { bypassesRateLimit } from "@/lib/super-admin";

const RequestSchema = z.object({
  code: z.string().min(1).max(500_000),
  language: z.enum(["javascript", "typescript", "python"]),
  name: z.string().min(1).max(100).optional().default("Paste scan"),
});

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

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { code, language, name } = parsed.data;
  const startedAt = Date.now();

  // Create scan record
  const scan = await prisma.scan.create({
    data: {
      name,
      sourceType: "PASTE",
      status: "SCANNING",
      createdById: session.user.id,
    },
  });

  try {
    const result = await scanCode(code, language as Language, "paste");
    const durationMs = Date.now() - startedAt;

    // Persist findings + summary in a transaction
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
          linesScanned: result.linesScanned,
          fileCount: 1,
          scanDurationMs: durationMs,
          completedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({ scanId: scan.id, ...result });
  } catch (err) {
    await prisma.scan.update({
      where: { id: scan.id },
      data: { status: "FAILED" },
    });
    console.error("[scan/paste]", err);
    return NextResponse.json(
      { error: "Scan failed" },
      { status: 500 }
    );
  }
}
