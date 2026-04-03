import { prisma } from "../src/lib/prisma";

const IDS = [
  "cmnib8pgu0001aj11lkgdxno0",
  "cmniass26001aaj9hl1fj98im",
  "cmniaf18d000daj9hkcbbv369",
];

async function main() {
  const deleted = await prisma.scan.deleteMany({ where: { id: { in: IDS } } });
  console.log(`Deleted ${deleted.count} scans`);
  await prisma.$disconnect();
}

main();
