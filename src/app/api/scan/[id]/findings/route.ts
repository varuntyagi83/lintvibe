import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: scanId } = await params;

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { createdById: true },
  });

  if (!scan || scan.createdById !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const findings = await prisma.finding.findMany({
    where: { scanId },
    orderBy: [{ severity: "asc" }, { lineNumber: "asc" }],
    take: 1000,
  });

  return NextResponse.json({ findings });
}
