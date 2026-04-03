import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/super-admin";

const VALID_FEATURES = ["unlimited_ai", "unlimited_scans", "deep_scan"] as const;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isSuperAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;
  const body = await req.json() as { feature?: string; note?: string };

  if (!body.feature || !VALID_FEATURES.includes(body.feature as typeof VALID_FEATURES[number])) {
    return NextResponse.json({ error: "Invalid feature" }, { status: 400 });
  }

  const exception = await prisma.userException.upsert({
    where: { userId_feature: { userId, feature: body.feature } },
    create: {
      userId,
      feature: body.feature,
      grantedBy: session!.user!.email!,
      note: body.note ?? null,
    },
    update: {
      grantedBy: session!.user!.email!,
      note: body.note ?? null,
    },
  });

  return NextResponse.json(exception);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isSuperAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;
  const body = await req.json() as { feature?: string };

  if (!body.feature) {
    return NextResponse.json({ error: "feature required" }, { status: 400 });
  }

  await prisma.userException.deleteMany({
    where: { userId, feature: body.feature },
  });

  return NextResponse.json({ ok: true });
}
