import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import GitHubIcon from "@/components/icons/GitHubIcon";
import { hasRepoScope } from "@/lib/github";
import GitHubScanClient from "./GitHubScanClient";

export default async function GitHubScanPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Check if user has a GitHub account linked
  const githubAccount = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "github" },
    select: { id: true },
  });

  const repoScope = githubAccount ? await hasRepoScope(session.user.id) : false;

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

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">GitHub repo scanner</h1>
          <p className="text-zinc-400 text-sm">
            Connect a repo and branch — we download, extract, and scan every JS, TS, and Python file against 41 AI-specific vulnerability rules.
          </p>
        </div>

        {!githubAccount ? (
          <div className="flex flex-col items-center justify-center py-24 border border-dashed border-zinc-800 rounded-xl text-center gap-4">
            <GitHubIcon className="h-10 w-10 text-zinc-600" />
            <div>
              <p className="font-semibold mb-1">GitHub not connected</p>
              <p className="text-zinc-500 text-sm">
                Sign in with GitHub to browse and scan your repositories.
              </p>
            </div>
            <a
              href="/api/auth/signin?provider=github"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition-colors"
            >
              <GitHubIcon className="h-4 w-4" />
              Connect GitHub
            </a>
          </div>
        ) : (
          <GitHubScanClient hasRepoScope={repoScope} />
        )}
      </main>
    </div>
  );
}
