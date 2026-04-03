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

  const { owner, repo, failOn } = await req.json() as {
    owner: string;
    repo: string;
    failOn?: string;
  };

  if (!owner?.trim() || !repo?.trim()) {
    return NextResponse.json({ error: "owner and repo are required" }, { status: 400 });
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
      failOn: failOn ?? "HIGH",
    },
  });

  return NextResponse.json(connected);
}

// DELETE — disconnect a repo
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { owner, repo } = await req.json() as { owner: string; repo: string };

  const existing = await prisma.connectedRepo.findUnique({
    where: { owner_repo: { owner, repo } },
  });

  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.connectedRepo.delete({ where: { owner_repo: { owner, repo } } });
  return NextResponse.json({ ok: true });
}
