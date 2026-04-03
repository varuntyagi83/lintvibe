import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrichFindingsWithAI } from "@/lib/ai-explain";
import { checkRateLimit } from "@/lib/rate-limit";
import { bypassesRateLimit, hasUnlimitedAI, isSuperAdmin } from "@/lib/super-admin";

// Free tier: 3 AI explanations per scan. Pro/Enterprise: unlimited.
const FREE_LIMIT = 3;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, retryAfter } = checkRateLimit(session.user.id, 20, 60 * 60 * 1000, bypassesRateLimit(session.user.email));
  if (!allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${Math.ceil((retryAfter ?? 60000) / 60000)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfter ?? 60000) / 1000)) } }
    );
  }

  const { id: scanId } = await params;

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      createdBy: { select: { role: true } },
    },
  });

  if (!scan || scan.createdById !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (scan.status !== "COMPLETE") {
    return NextResponse.json({ error: "Scan not complete" }, { status: 400 });
  }

  // Determine limit: super admin + exception holders + ADMINs get unlimited
  const userRole = (session.user as { role?: string }).role;
  const userExceptions = await prisma.userException
    .findMany({ where: { userId: session.user.id }, select: { feature: true } })
    .then((e) => e.map((x) => x.feature));
  const isPro = hasUnlimitedAI(session.user.email, userExceptions) || userRole === "ADMIN";
  const limit = isPro ? Infinity : FREE_LIMIT;

  try {
    const enriched = await enrichFindingsWithAI(scanId, limit);
    return NextResponse.json({ enriched, limited: !isPro && enriched >= FREE_LIMIT });
  } catch (err) {
    console.error("[ai-explain]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
  }
}
