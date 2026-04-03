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

  const { id } = await params;
  const body = await req.json() as { falsePositive?: boolean; fixed?: boolean };

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
