import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isSuperAdmin, SUPER_ADMIN_EMAIL } from "@/lib/super-admin";

const VALID_ROLES = ["ADMIN", "MEMBER", "VIEWER"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  if (!session?.user || !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { role?: string };

  if (!body.role || !VALID_ROLES.includes(body.role as typeof VALID_ROLES[number])) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Protect the super admin — nobody can change their role
  const target = await prisma.user.findUnique({ where: { id }, select: { email: true, orgId: true } });
  if (target?.email === SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: "Cannot modify super admin role" }, { status: 403 });
  }

  // Non-super-admins can only manage users within their own org
  if (!isSuperAdmin(session.user.email)) {
    const callerOrgId = (session.user as { orgId?: string | null }).orgId;
    if (!callerOrgId || target?.orgId !== callerOrgId) {
      return NextResponse.json({ error: "Cannot manage users outside your organization" }, { status: 403 });
    }
  }

  // Only super admin can grant ADMIN role to others
  if (body.role === "ADMIN" && !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: "Only super admin can grant ADMIN role" }, { status: 403 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: body.role as typeof VALID_ROLES[number] },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json(updated);
}
