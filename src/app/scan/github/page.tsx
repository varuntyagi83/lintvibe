import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
import { prisma } from "@/lib/prisma";
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
            Connect a repo and branch — we download, extract, and scan every JS, TS, and Python file against 26 AI-specific vulnerability rules.
          </p>
        </div>

        {!githubAccount ? (
          <div className="flex flex-col items-center justify-center py-24 border border-dashed border-zinc-800 rounded-xl text-center gap-4">
            <GithubIcon className="h-10 w-10 text-zinc-600" />
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
              <GithubIcon className="h-4 w-4" />
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
