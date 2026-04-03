import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGitHubToken, getRepoBranches } from "@/lib/github";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");

  if (!owner || !repo) {
    return NextResponse.json({ error: "Missing owner or repo" }, { status: 400 });
  }

  const token = await getGitHubToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
  }

  try {
    const branches = await getRepoBranches(token, owner, repo);
    return NextResponse.json({ branches });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch branches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
