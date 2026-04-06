import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { Users, Shield, ScanLine, AlertTriangle, Crown, Zap } from "lucide-react";
import AdminRoleSelector from "./AdminRoleSelector";
import ExceptionManager from "./ExceptionManager";
import { isSuperAdmin, SUPER_ADMIN_EMAIL } from "@/lib/super-admin";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  if (!isAdmin) redirect("/dashboard");

  const superAdmin = isSuperAdmin(session.user.email);
  const orgId = (session.user as { orgId?: string | null }).orgId ?? null;

  // Super admins see all orgs; regular admins see only their own org
  const orgFilter = superAdmin ? {} : { orgId: orgId ?? undefined };
  const userOrgFilter = superAdmin ? {} : { orgId: orgId ?? undefined };

  const [users, totalScans, totalFindings, criticalOpen, recentScans] = await Promise.all([
    prisma.user.findMany({
      where: userOrgFilter,
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { scans: true } },
        exceptions: { select: { feature: true, note: true } },
      },
    }),
    prisma.scan.count({ where: orgFilter }),
    prisma.finding.count({ where: { falsePositive: false, scan: orgFilter } }),
    prisma.finding.count({ where: { severity: "CRITICAL", fixed: false, falsePositive: false, scan: orgFilter } }),
    prisma.scan.findMany({
      where: orgFilter,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { summary: true, createdBy: { select: { email: true } } },
    }),
  ]);

  const stats = [
    { label: "Total users", value: users.length, icon: Users, color: "text-blue-400" },
    { label: "Total scans", value: totalScans, icon: ScanLine, color: "text-purple-400" },
    { label: "Total findings", value: totalFindings, icon: Shield, color: "text-orange-400" },
    { label: "Critical open", value: criticalOpen, icon: AlertTriangle, color: "text-red-400", danger: criticalOpen > 0 },
  ];

  const FEATURE_LABELS: Record<string, string> = {
    unlimited_ai: "Unlimited AI",
    unlimited_scans: "Unlimited scans",
    deep_scan: "Deep scan",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader email={session.user.email} isAdmin nav="admin" />

      <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-8">
          <Crown className="h-5 w-5 text-yellow-500" />
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          {superAdmin && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-950 border border-yellow-700 text-yellow-400 text-xs font-semibold">
              <Zap className="h-3 w-3" />
              Super Admin
            </span>
          )}
        </div>

        {/* System stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map(({ label, value, icon: Icon, color, danger }) => (
            <div key={label} className="glass rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`h-4 w-4 ${color}`} />
                <p className="text-muted-foreground text-xs font-medium">{label}</p>
              </div>
              <p className={`text-3xl font-bold ${danger ? "text-red-400" : "text-foreground"}`}>
                {value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Recent scans */}
        <div className="mb-10">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Recent scans (all users)
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Project</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">User</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Grade</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Findings</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.map((scan) => (
                  <tr key={scan.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{scan.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{scan.createdBy?.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      {scan.summary?.grade ? (
                        <span className="font-bold text-sm">{scan.summary.grade}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{scan.summary?.totalFindings ?? 0}</span>
                      {(scan.summary?.criticalCount ?? 0) > 0 && (
                        <span className="ml-1.5 text-xs text-red-400">{scan.summary!.criticalCount} crit</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(scan.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Users table */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Users ({users.length})
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Role</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Exceptions</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Scans</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isThisSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
                  return (
                    <tr key={user.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.email}</span>
                          {isThisSuperAdmin && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-950 border border-yellow-700 text-yellow-400 text-xs font-semibold">
                              <Zap className="h-2.5 w-2.5" />
                              Super
                            </span>
                          )}
                          {user.email === session.user?.email && !isThisSuperAdmin && (
                            <span className="text-xs text-muted-foreground">(you)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isThisSuperAdmin ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-950 text-yellow-400 border border-yellow-700">
                            SUPER_ADMIN
                          </span>
                        ) : (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                            user.role === "ADMIN"
                              ? "bg-yellow-950 text-yellow-400 border border-yellow-800"
                              : user.role === "VIEWER"
                              ? "bg-muted text-muted-foreground border border-border"
                              : "bg-blue-950 text-blue-400 border border-blue-800"
                          }`}>
                            {user.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.exceptions.map((ex) => (
                            <span key={ex.feature} className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-400 text-xs">
                              {FEATURE_LABELS[ex.feature] ?? ex.feature}
                            </span>
                          ))}
                          {user.exceptions.length === 0 && (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user._count.scans}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {superAdmin && !isThisSuperAdmin && (
                            <ExceptionManager
                              userId={user.id}
                              currentExceptions={user.exceptions.map((e) => e.feature)}
                            />
                          )}
                          {!isThisSuperAdmin && (
                            <AdminRoleSelector userId={user.id} currentRole={user.role} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
