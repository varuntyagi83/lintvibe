import { prisma } from "@/lib/prisma";

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  updated_at: string;
  language: string | null;
}

export interface GitHubBranch {
  name: string;
}

export async function getGitHubToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "github" },
    select: { access_token: true, scope: true },
  });
  return account?.access_token ?? null;
}

export async function hasRepoScope(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "github" },
    select: { scope: true },
  });
  return (account?.scope ?? "").includes("repo");
}

export async function listUserRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetch(
    "https://api.github.com/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `GitHub API error ${res.status}`);
  }
  return res.json() as Promise<GitHubRepo[]>;
}

export async function getRepoBranches(
  token: string,
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch branches: ${res.status}`);
  return res.json() as Promise<GitHubBranch[]>;
}

export async function downloadRepoZip(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<Buffer> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) throw new Error(`Failed to download repo: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
