import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scanCode } from "@/lib/engine";
import type { Language } from "@/lib/engine";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { bypassesRateLimit, hasUnlimitedScans } from "@/lib/super-admin";

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
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Viewers cannot create scans" }, { status: 403 });
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
  const orgId = (session.user as { orgId?: string }).orgId ?? null;

  // Enforce free tier monthly scan quota (10 scans/month)
  const tier = session.user.tier ?? "FREE";
  if (tier !== "PRO") {
    const exceptions = await prisma.userException.findMany({
      where: { userId: session.user.id },
      select: { feature: true },
    });
    const exceptionFeatures = exceptions.map((e) => e.feature);
    if (!hasUnlimitedScans(session.user.email, exceptionFeatures)) {
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
  }

  const scan = await prisma.scan.create({
    data: {
      name,
      sourceType: "PASTE",
      status: "SCANNING",
      createdById: session.user.id,
      orgId,
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
          riskCategories: f.riskCategories ?? [],
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
