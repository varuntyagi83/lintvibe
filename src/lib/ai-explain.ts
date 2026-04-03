import { openai } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

interface FindingInput {
  id: string;
  title: string;
  severity: string;
  category: string;
  description: string;
  codeSnippet: string | null;
  ruleId: string;
}

interface AIAnalysis {
  explanation: string;
  attackVector: string;
  fixedCode: string;
  aiToolContext: string;
}

const SYSTEM_PROMPT = `You are a principal security engineer with 30+ years of QA and AppSec experience. You have personally pulled production systems offline at 2am because of exactly the kinds of vulnerabilities you are reviewing now. You are direct, specific, and slightly impatient with sloppy AI-generated code.

Given a code snippet and a detected vulnerability, respond with a JSON object containing exactly these four fields:

- explanation: In your own blunt voice, explain why this specific code is dangerous. Reference the actual variable names, function calls, or patterns you see. Be concrete — not generic. 2-3 sentences max.
- attackVector: Describe the exact attack step-by-step as an attacker would execute it against this code. Be precise: what request do they send, what do they get back, what's the blast radius. 2 sentences.
- fixedCode: The corrected code. Show only the relevant changed lines. No markdown fences, no explanation — just the fixed code.
- aiToolContext: Name the AI coding tool(s) that commonly produce this exact pattern and the reason they do it (training bias, prompt shortcut, etc). 1 sentence.

Rules: Valid JSON only. No markdown outside the JSON. No hedging language ("this could potentially" → banned). Call it what it is.`;

async function analyzeOneFinding(finding: FindingInput): Promise<AIAnalysis | null> {
  try {
    const userMessage = `Vulnerability: ${finding.title}
Severity: ${finding.severity}
Category: ${finding.category}
Rule: ${finding.ruleId}

Code snippet:
${finding.codeSnippet ?? "(no snippet available)"}

Background: ${finding.description}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    return JSON.parse(raw) as AIAnalysis;
  } catch {
    return null;
  }
}

export async function enrichFindingsWithAI(
  scanId: string,
  limit: number = Infinity
): Promise<number> {
  // Only analyse CRITICAL and HIGH findings that haven't been explained yet
  const findingsQuery = prisma.finding.findMany({
    where: {
      scanId,
      severity: { in: ["CRITICAL", "HIGH"] },
      aiExplanation: null,
      falsePositive: false,
    },
    ...(isFinite(limit) ? { take: limit } : {}),
    orderBy: { severity: "asc" }, // CRITICAL first
  });

  const findings = await findingsQuery;

  if (findings.length === 0) return 0;

  // Process in batches of 5 (parallel within batch, sequential between batches)
  const BATCH_SIZE = 5;
  let enriched = 0;

  for (let i = 0; i < findings.length; i += BATCH_SIZE) {
    const batch = findings.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map((f) => analyzeOneFinding(f))
    );

    const updates = batch
      .map((f, idx) => ({ finding: f, analysis: results[idx] }))
      .filter(({ analysis }) => analysis !== null);

    await Promise.all(
      updates.map(({ finding, analysis }) =>
        prisma.finding.update({
          where: { id: finding.id },
          data: {
            aiExplanation: `${analysis!.explanation}\n\nAttack vector: ${analysis!.attackVector}\n\n${analysis!.aiToolContext}`,
            fixSuggestion: analysis!.fixedCode || finding.fixSuggestion,
          },
        })
      )
    );

    enriched += updates.length;
  }

  return enriched;
}
