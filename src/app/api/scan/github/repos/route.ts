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
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[github/repos]", raw);
    // Expose rate-limit info (actionable) but not internal stack details
    const isRateLimit = /rate.?limit/i.test(raw);
    return NextResponse.json(
      { error: isRateLimit ? "GitHub API rate limit reached. Please wait and try again." : "Failed to fetch repositories" },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
