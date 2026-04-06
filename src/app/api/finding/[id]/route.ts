import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Viewers cannot modify findings" }, { status: 403 });
  }

  const { id } = await params;
  let body: { falsePositive?: boolean; fixed?: boolean };
  try {
    const raw = await req.json();
    if (typeof raw !== "object" || raw === null) throw new Error();
    body = {
      ...(typeof raw.falsePositive === "boolean" ? { falsePositive: raw.falsePositive } : {}),
      ...(typeof raw.fixed === "boolean" ? { fixed: raw.fixed } : {}),
    };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Verify ownership via the scan relation
  const finding = await prisma.finding.findUnique({
    where: { id },
    include: { scan: { select: { createdById: true } } },
  });

  if (!finding || finding.scan.createdById !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.finding.update({
    where: { id },
    data: {
      ...(body.falsePositive !== undefined ? { falsePositive: body.falsePositive } : {}),
      ...(body.fixed !== undefined ? { fixed: body.fixed } : {}),
    },
  });

  return NextResponse.json(updated);
}
