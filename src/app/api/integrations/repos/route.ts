import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import crypto from "crypto";

// GET — list connected repos for current user
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const repos = await prisma.connectedRepo.findMany({
    where: { userId: session.user.id! },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(repos);
}

// POST — connect a new repo
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { owner, repo, failOn: rawFailOn } = await req.json() as {
    owner: string;
    repo: string;
    failOn?: string;
  };
  const VALID_FAIL_ON = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
  const failOn = VALID_FAIL_ON.includes(rawFailOn as typeof VALID_FAIL_ON[number]) ? rawFailOn : "HIGH";

  if (!owner?.trim() || !repo?.trim()) {
    return NextResponse.json({ error: "owner and repo are required" }, { status: 400 });
  }

  // Validate GitHub identifier format to prevent malformed API calls
  const GITHUB_OWNER_RE = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,37}[a-zA-Z0-9])?$/;
  const GITHUB_REPO_RE = /^[a-zA-Z0-9\-_.]{1,100}$/;
  if (!GITHUB_OWNER_RE.test(owner) || !GITHUB_REPO_RE.test(repo)) {
    return NextResponse.json({ error: "Invalid GitHub owner or repository name" }, { status: 400 });
  }

  // Check if already connected (by another user)
  const existing = await prisma.connectedRepo.findUnique({
    where: { owner_repo: { owner, repo } },
  });
  if (existing && existing.userId !== session.user.id) {
    return NextResponse.json(
      { error: "This repository is already connected by another user" },
      { status: 409 }
    );
  }

  const webhookSecret = crypto.randomBytes(32).toString("hex");

  const connected = await prisma.connectedRepo.upsert({
    where: { owner_repo: { owner, repo } },
    create: {
      userId: session.user.id!,
      owner,
      repo,
      webhookSecret,
      failOn: failOn ?? "HIGH",
    },
    update: {
      // Always rotate the secret on reconnect so the returned value matches
      // what gets saved — prevents the UI showing a secret that differs from
      // what's stored in the database.
      webhookSecret,
      failOn: failOn ?? "HIGH",
    },
  });

  return NextResponse.json(connected);
}

// DELETE — disconnect a repo
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let owner: string, repo: string;
  try {
    const body = await req.json();
    if (typeof body?.owner !== "string" || typeof body?.repo !== "string") throw new Error();
    owner = body.owner;
    repo = body.repo;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const existing = await prisma.connectedRepo.findUnique({
    where: { owner_repo: { owner, repo } },
  });

  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.connectedRepo.delete({ where: { owner_repo: { owner, repo } } });
  return NextResponse.json({ ok: true });
}
