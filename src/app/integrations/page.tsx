import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, ArrowLeft, GitBranch } from "lucide-react";
import ConnectRepoForm from "./ConnectRepoForm";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const repos = await prisma.connectedRepo.findMany({
    where: { userId: session.user.id! },
    orderBy: { createdAt: "desc" },
  });

  const appUrl = process.env.NEXTAUTH_URL ?? "https://vibescan.app";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-500" />
          <span className="font-bold tracking-tight">VibeScan</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <span>{session.user.email}</span>
          <Link href="/api/auth/signout" className="hover:text-zinc-200 transition-colors">
            Sign out
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <GitBranch className="h-5 w-5 text-red-500" />
          <h1 className="text-2xl font-bold">PR Integrations</h1>
        </div>
        <p className="text-zinc-400 text-sm mb-8">
          Connect GitHub repositories to automatically scan pull requests. VibeScan will post a
          review comment and block the merge if CRITICAL or HIGH vulnerabilities are introduced.
        </p>

        <ConnectRepoForm
          initialRepos={repos.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
          }))}
          webhookBaseUrl={appUrl}
        />
      </main>
    </div>
  );
}
