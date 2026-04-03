import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { ScanReport } from "@/lib/pdf/ScanReport";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SEV_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const scan = await prisma.scan.findUnique({
    where: { id },
    include: {
      summary: true,
      findings: {
        where: { falsePositive: false },
        orderBy: [{ lineNumber: "asc" }],
      },
    },
  });

  if (!scan || scan.createdById !== session.user.id) {
    notFound();
  }

  const sortedFindings = [...scan.findings].sort(
    (a, b) =>
      (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) ||
      (a.lineNumber ?? 0) - (b.lineNumber ?? 0)
  );

  const buffer = await renderToBuffer(
    createElement(ScanReport, { scan, findings: sortedFindings })
  );

  const safeName = scan.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const filename = `vibescan-${safeName}.pdf`;

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
