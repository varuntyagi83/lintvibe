import { prisma } from "../src/lib/prisma";

async function main() {
  const user = await prisma.user.update({
    where: { email: "varun.tyagi83@gmail.com" },
    data: { role: "ADMIN" },
    select: { id: true, email: true, role: true },
  });
  console.log("✓ Admin access granted:", user);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
