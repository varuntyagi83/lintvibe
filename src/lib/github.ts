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

export interface PRFile {
  filename: string;
  status: string; // added | modified | removed | renamed
  raw_url: string;
}

export async function getPRFiles(
  token: string,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PRFile[]> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) throw new Error(`Failed to get PR files: ${res.status}`);
  return res.json() as Promise<PRFile[]>;
}

export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json() as { content?: string; encoding?: string };
  if (data.encoding !== "base64" || !data.content) return null;
  return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
}

export async function postCommitStatus(
  token: string,
  owner: string,
  repo: string,
  sha: string,
  state: "pending" | "success" | "failure",
  description: string,
  targetUrl?: string
): Promise<void> {
  await fetch(`https://api.github.com/repos/${owner}/${repo}/statuses/${sha}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      state,
      description: description.slice(0, 140),
      context: "VibeScan / Security",
      ...(targetUrl ? { target_url: targetUrl } : {}),
    }),
  });
}

export async function postPRReview(
  token: string,
  owner: string,
  repo: string,
  pullNumber: number,
  commitId: string,
  body: string,
  event: "COMMENT" | "REQUEST_CHANGES" | "APPROVE"
): Promise<void> {
  await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ commit_id: commitId, body, event }),
    }
  );
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
