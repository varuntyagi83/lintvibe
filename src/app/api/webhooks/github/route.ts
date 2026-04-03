import { prisma } from "@/lib/prisma";
import {
  getPRFiles,
  getFileContent,
  postCommitStatus,
  postPRReview,
} from "@/lib/github";
import { scanFiles } from "@/lib/engine/scan-files";
import { isScannablePath } from "@/lib/engine/scan-files";
import type { FileEntry } from "@/lib/engine/scan-files";
import crypto from "crypto";

export const maxDuration = 45;

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(payload: string, header: string, secret: string): boolean {
  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf-8"),
      Buffer.from(header, "utf-8")
    );
  } catch {
    return false;
  }
}

// ─── Review comment builder ───────────────────────────────────────────────────

const SEV_EMOJI: Record<string, string> = {
  CRITICAL: "🔴",
  HIGH: "🟠",
  MEDIUM: "🟡",
  LOW: "🔵",
};

function buildReviewBody(
  result: Awaited<ReturnType<typeof scanFiles>>,
  scanUrl: string
): string {
  const { allFindings: findings, linesScanned, fileCount } = result as unknown as {
    allFindings: Array<{
      severity: string; title: string; filePath: string; lineNumber: number | null; description: string;
    }>;
    linesScanned: number;
    fileCount: number;
  };

  const critical = findings.filter((f) => f.severity === "CRITICAL");
  const high = findings.filter((f) => f.severity === "HIGH");
  const medium = findings.filter((f) => f.severity === "MEDIUM");
  const total = findings.length;

  if (total === 0) {
    return `## ✅ VibeScan — No issues found\n\n${fileCount} file${fileCount !== 1 ? "s" : ""} · ${linesScanned.toLocaleString()} lines scanned · All 26 rules passed\n\n---\n*[VibeScan](${scanUrl}) — AI code security scanner*`;
  }

  const lines: string[] = [];
  lines.push(`## ${critical.length > 0 ? "🔴" : high.length > 0 ? "🟠" : "🟡"} VibeScan Security Report`);
  lines.push("");

  const parts: string[] = [];
  if (critical.length) parts.push(`**${critical.length} CRITICAL**`);
  if (high.length) parts.push(`**${high.length} high**`);
  if (medium.length) parts.push(`${medium.length} medium`);
  lines.push(parts.join(" · ") + ` finding${total !== 1 ? "s" : ""} in changed files`);
  lines.push("");

  for (const sev of ["CRITICAL", "HIGH", "MEDIUM"] as const) {
    const group = findings.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    lines.push(`### ${SEV_EMOJI[sev]} ${sev.charAt(0) + sev.slice(1).toLowerCase()}`);
    for (const f of group.slice(0, 8)) {
      const loc = f.lineNumber ? `:${f.lineNumber}` : "";
      lines.push(`- **${f.title}** — \`${f.filePath}${loc}\``);
    }
    if (group.length > 8) lines.push(`- *…and ${group.length - 8} more*`);
    lines.push("");
  }

  lines.push(`**Risk score: ${fileCount} file${fileCount !== 1 ? "s" : ""} scanned**`);
  lines.push("");
  lines.push(`---`);
  lines.push(`*[VibeScan](${scanUrl}) — AI code security scanner*`);

  return lines.join("\n");
}

// ─── PR processor ─────────────────────────────────────────────────────────────

async function processPR(opts: {
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
  token: string;
  failOn: string;
  appUrl: string;
}) {
  const { owner, repo, pullNumber, headSha, token, failOn, appUrl } = opts;

  // Post pending status immediately
  await postCommitStatus(token, owner, repo, headSha, "pending", "VibeScan is scanning…");

  try {
    // Get list of changed files
    const prFiles = await getPRFiles(token, owner, repo, pullNumber);
    const scannableFiles = prFiles.filter(
      (f) => f.status !== "removed" && isScannablePath(f.filename)
    );

    if (scannableFiles.length === 0) {
      await postCommitStatus(token, owner, repo, headSha, "success", "No scannable files changed");
      return;
    }

    // Download file contents in parallel
    const entries = await Promise.all(
      scannableFiles.map(async (f) => {
        const content = await getFileContent(token, owner, repo, f.filename, headSha);
        if (!content) return null;
        const language = isScannablePath(f.filename);
        if (!language) return null;
        return { path: f.filename, content, language } as FileEntry;
      })
    );

    const files = entries.filter((e): e is FileEntry => e !== null);

    if (files.length === 0) {
      await postCommitStatus(token, owner, repo, headSha, "success", "No scannable files changed");
      return;
    }

    // Run scan
    const scanResult = await scanFiles(files);
    const findings = (scanResult as unknown as { allFindings: Array<{ severity: string }> }).allFindings ?? [];

    const SEV_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
    const threshold = SEV_RANK[failOn] ?? 3;
    const blocking = findings.filter((f) => (SEV_RANK[f.severity] ?? 0) >= threshold);
    const failed = blocking.length > 0;

    // Post commit status
    const desc = failed
      ? `${blocking.length} ${failOn}+ finding${blocking.length !== 1 ? "s" : ""} — merge blocked`
      : findings.length === 0
      ? "No vulnerabilities found"
      : `${findings.length} low-severity finding${findings.length !== 1 ? "s" : ""} — OK to merge`;

    await postCommitStatus(
      token, owner, repo, headSha,
      failed ? "failure" : "success",
      desc,
      appUrl
    );

    // Post PR review comment
    const reviewBody = buildReviewBody(scanResult as never, appUrl);
    await postPRReview(
      token, owner, repo, pullNumber, headSha,
      reviewBody,
      failed ? "REQUEST_CHANGES" : "COMMENT"
    );
  } catch (err) {
    console.error("VibeScan PR scan error:", err);
    await postCommitStatus(token, owner, repo, headSha, "failure", "VibeScan scan failed — check logs");
  }
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const event = req.headers.get("x-github-event") ?? "";

  if (event !== "pull_request") {
    return Response.json({ ok: true, skipped: event });
  }

  let payload: {
    action: string;
    number: number;
    pull_request: { head: { sha: string } };
    repository: { name: string; owner: { login: string } };
  };

  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, number: pullNumber, pull_request, repository } = payload;

  if (!["opened", "synchronize", "reopened"].includes(action)) {
    return Response.json({ ok: true, skipped: action });
  }

  const owner = repository.owner.login;
  const repo = repository.name;
  const headSha = pull_request.head.sha;

  // Find the connected repo record
  const connected = await prisma.connectedRepo.findUnique({
    where: { owner_repo: { owner, repo } },
    include: {
      user: {
        include: { accounts: { where: { provider: "github" } } },
      },
    },
  });

  if (!connected) {
    return Response.json({ error: "Repo not connected" }, { status: 404 });
  }

  if (!verifySignature(body, signature, connected.webhookSecret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const token = connected.user.accounts[0]?.access_token;
  if (!token) {
    return Response.json({ error: "No GitHub token" }, { status: 500 });
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "https://vibescan.app";

  // Process synchronously (within maxDuration)
  await processPR({ owner, repo, pullNumber, headSha, token, failOn: connected.failOn, appUrl });

  return Response.json({ ok: true });
}
