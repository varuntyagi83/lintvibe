import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGitHubToken, listUserRepos } from "@/lib/github";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getGitHubToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: "GitHub not connected", code: "NO_GITHUB" }, { status: 400 });
  }

  try {
    const repos = await listUserRepos(token);
    return NextResponse.json({ repos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch repos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
