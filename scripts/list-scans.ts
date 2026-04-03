import { prisma } from "../src/lib/prisma";

async function main() {
  const scans = await prisma.scan.findMany({
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  scans.forEach((s) =>
    console.log(s.id, "|", s.name, "|", s.createdAt.toISOString())
  );
  await prisma.$disconnect();
}

main();
