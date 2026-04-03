// vibescan-disable-file — scanner engine internals, not application code
import { openai } from "@/lib/openai";
import type { FileEntry } from "@/lib/engine/scan-files";

export interface DeepFinding {
  filePath: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  lineNumber: number;
  description: string;
  attackVector: string;
  fix: string;
}

const SYSTEM_PROMPT = `You are a principal security engineer with 30+ years of AppSec experience doing a manual code review.

Your job is to find security vulnerabilities that STATIC ANALYSIS TOOLS MISS — semantic and logic-level issues only.

Focus exclusively on:
- IDOR (Insecure Direct Object Reference): user-supplied IDs queried in the DB without verifying the requester owns that resource
- Mass assignment: req.body or request.json() spread directly into DB create/update without field allowlisting
- Broken access control: authenticated but not authorised — user can access other users' data or perform admin actions
- Insecure randomness: Math.random() used for tokens, session IDs, password reset codes, or OTPs
- SSRF: user-controlled URLs or hostnames passed to server-side fetch() or http requests
- Privilege escalation: role or permission fields accepted from user input and written to DB
- Missing ownership check: mutating a resource (update/delete) using an ID from the request without confirming it belongs to the current user

DO NOT report — these are already caught by static analysis:
- Hardcoded secrets or API keys
- SQL injection via string interpolation
- XSS via dangerouslySetInnerHTML
- Missing authentication (no session check at all)
- eval() usage
- CORS misconfiguration

Rules:
- Only flag issues you are CERTAIN about — no speculative findings
- Reference actual variable names, function names, and line patterns from the code
- Return [] if no semantic issues are found
- Valid JSON array only — no markdown, no explanation outside the array

Each finding must have exactly: { "title": string, "severity": "CRITICAL"|"HIGH"|"MEDIUM"|"LOW", "lineNumber": integer, "description": string, "attackVector": string, "fix": string }`;

const MAX_FILE_CHARS = 12_000; // ~300 lines — enough context without blowing token budget

async function analyzeFile(filePath: string, content: string): Promise<DeepFinding[]> {
  const truncated = content.slice(0, MAX_FILE_CHARS);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `File: ${filePath}\n\n${truncated}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return [];

    // GPT sometimes wraps in { findings: [...] } or returns array directly
    const parsed = JSON.parse(raw);
    const findings: DeepFinding[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.findings)
      ? parsed.findings
      : [];

    return findings
      .filter(
        (f) =>
          f.title &&
          f.severity &&
          ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(f.severity) &&
          f.description &&
          f.fix
      )
      .map((f) => ({ ...f, filePath, lineNumber: f.lineNumber ?? 1 }));
  } catch {
    return [];
  }
}

// Only bother scanning API routes, server components, and lib files — skip UI-only files
function isWorthDeepScanning(filePath: string): boolean {
  if (/\.(test|spec)\.[jt]sx?$|__tests__|fixtures?\/|mocks?\//i.test(filePath)) return false;
  if (/\/(components|ui|styles|public|assets)\//i.test(filePath)) return false;
  return true;
}

export async function deepScanFiles(files: FileEntry[]): Promise<DeepFinding[]> {
  const targets = files.filter((f) => isWorthDeepScanning(f.path));

  // Process in batches of 4 (parallel within batch)
  const BATCH_SIZE = 4;
  const allFindings: DeepFinding[] = [];

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((f) => analyzeFile(f.path, f.content)));
    results.forEach((r) => allFindings.push(...r));
  }

  return allFindings;
}
