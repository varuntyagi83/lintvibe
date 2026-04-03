/**
 * Project-graph analyser — VibeScan's core differentiator.
 *
 * Semgrep / SonarQube / Snyk scan each file in isolation.
 * This module builds a lightweight project graph across all files and runs
 * cross-file semantic rules that per-file pattern matching can never catch:
 *
 *   1. IDOR            — dynamic route queries DB by ID with no ownership check
 *   2. Server-action   — "use server" function mutates DB without auth()
 *   3. Middleware gap  — mutation route is not covered by auth middleware
 *   4. Mass assignment — raw request body spread directly into Prisma write
 *   5. Secret leak     — "use client" component imports a module with server secrets
 */

import type { FileEntry } from "./scan-files";
import type { Finding } from "./types";

// ─── Shared patterns ──────────────────────────────────────────────────────────

const AUTH_RE =
  /getServerSession|auth\s*\(\s*\)|withAuth|clerkMiddleware|authMiddleware|currentUser\s*\(\s*\)|validateSession|locals\.user|checkAuth|requireAuth|session\.user|session\.userId|verifyToken|verifyJwt|jwt\.verify/;

const OWNERSHIP_RE = /userId|createdById|authorId|ownerId|owner\b|creator\b/;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RouteInfo {
  filePath: string;
  routePath: string;
  methods: string[];
  hasAuth: boolean;
  hasRateLimit: boolean;
  prismaOps: PrismaOp[];
  paramNames: string[];
  bodyRead: boolean;
  hasOwnershipCheck: boolean;
  hasMassAssignment: boolean;
}

interface PrismaOp {
  model: string;
  method: string;
  lineNumber: number;
  hasWhereId: boolean;
  hasOwnershipFilter: boolean;
  fromBodyDirect: boolean;
}

interface ServerActionInfo {
  filePath: string;
  functionName: string;
  lineNumber: number;
  hasAuth: boolean;
  hasPrismaWrite: boolean;
}

interface MiddlewareInfo {
  filePath: string | null;
  hasAuth: boolean;
  matcherPatterns: string[];
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

/**
 * Convert a file path like `src/app/api/users/[id]/route.ts`
 * to a URL path like `/api/users/[id]`.
 */
function extractRoutePath(filePath: string): string | null {
  const match = filePath.match(/(?:src\/)?app\/(.+?)\/route\.[jt]sx?$/);
  if (!match) return null;
  const segments = match[1]
    .split("/")
    .filter((s) => !/^\([^)]+\)$/.test(s)); // strip (group) segments
  return "/" + segments.join("/");
}

function extractDynamicParams(routePath: string): string[] {
  const params: string[] = [];
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(routePath)) !== null) {
    params.push(m[1].replace(/^\.\.\./, ""));
  }
  return params;
}

function extractPrismaOps(code: string): PrismaOp[] {
  const lines = code.split("\n");
  const ops: PrismaOp[] = [];
  const re =
    /prisma\.(\w+)\.(findUnique|findFirst|findMany|create|update|updateMany|delete|deleteMany|upsert)\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const lineNumber = code.slice(0, m.index).split("\n").length;
    const lineIdx = lineNumber - 1;
    // Inspect the 15 lines after the call to find the where/data clauses
    const block = lines
      .slice(Math.max(0, lineIdx - 1), Math.min(lines.length, lineIdx + 15))
      .join("\n");

    ops.push({
      model: m[1],
      method: m[2],
      lineNumber,
      hasWhereId: /where\s*:\s*\{[^}]*\bid\b/.test(block),
      hasOwnershipFilter: OWNERSHIP_RE.test(block),
      // data: body  OR  data: { ...body }  OR  data: { ...data }
      fromBodyDirect:
        /data\s*:\s*(?:body|data|payload)\b/.test(block) ||
        /data\s*:\s*\{[^}]*\.\.\.\s*(?:body|data|payload)\b/.test(block),
    });
  }
  return ops;
}

function parseRouteFile(file: FileEntry): RouteInfo | null {
  const routePath = extractRoutePath(file.path);
  if (!routePath) return null;

  const code = file.content;

  // Extract HTTP method exports
  const methodMatches = code.match(
    /export\s+(?:const\s+\w+\s*=\s*)?(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)|export\s+(?:const\s+)?(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*=/gi
  );
  const methods = [
    ...new Set(
      (methodMatches ?? [])
        .map((m) => {
          const match = m.match(/\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/);
          return match ? match[1] : null;
        })
        .filter(Boolean) as string[]
    ),
  ];

  if (methods.length === 0) return null;

  const paramNames = extractDynamicParams(routePath);
  const prismaOps = extractPrismaOps(code);
  const hasAuth = AUTH_RE.test(code);

  const hasMassAssignment = prismaOps.some(
    (op) =>
      ["create", "update", "upsert"].includes(op.method) && op.fromBodyDirect
  );

  const hasOwnershipCheck =
    prismaOps.some((op) => op.hasOwnershipFilter) || OWNERSHIP_RE.test(code);

  return {
    filePath: file.path,
    routePath,
    methods,
    hasAuth,
    hasRateLimit: /checkRateLimit|rateLimit|rateLimiter/.test(code),
    prismaOps,
    paramNames,
    bodyRead:
      /request\.json\(\)|req\.body\b|await request\.formData/.test(code),
    hasOwnershipCheck,
    hasMassAssignment,
  };
}

function parseServerActions(file: FileEntry): ServerActionInfo[] {
  const code = file.content;
  // Must be a "use server" file (directive at top OR inside function)
  if (!/['"]use server['"]/m.test(code)) return [];

  const lines = code.split("\n");
  const actions: ServerActionInfo[] = [];
  const fnRe = /export\s+async\s+function\s+(\w+)/g;
  let m: RegExpExecArray | null;

  while ((m = fnRe.exec(code)) !== null) {
    const lineNumber = code.slice(0, m.index).split("\n").length;
    // Capture the next 40 lines as the function body approximation
    const bodyLines = lines.slice(
      lineNumber,
      Math.min(lines.length, lineNumber + 40)
    );
    const body = bodyLines.join("\n");

    const hasPrismaWrite =
      /prisma\.\w+\.(create|update|updateMany|delete|deleteMany|upsert)\s*\(/.test(
        body
      );

    if (!hasPrismaWrite) continue;

    // Auth may be called before the function or inside it
    const preamble = code.slice(0, m.index + 200);
    const hasAuth = AUTH_RE.test(body) || AUTH_RE.test(preamble);

    actions.push({
      filePath: file.path,
      functionName: m[1],
      lineNumber,
      hasAuth,
      hasPrismaWrite,
    });
  }

  return actions;
}

function parseMiddleware(files: FileEntry[]): MiddlewareInfo {
  const mw = files.find((f) => /(?:^|\/)middleware\.[jt]sx?$/.test(f.path));
  if (!mw) return { filePath: null, hasAuth: false, matcherPatterns: [] };

  const code = mw.content;
  const hasAuth = AUTH_RE.test(code);
  const patterns: string[] = [];

  // matcher: ['/api/:path*', ...]
  const arrMatch = code.match(/matcher\s*:\s*\[([^\]]+)\]/);
  if (arrMatch) {
    const itemRe = /['"]([^'"]+)['"]/g;
    let item: RegExpExecArray | null;
    while ((item = itemRe.exec(arrMatch[1])) !== null) {
      patterns.push(item[1]);
    }
  } else {
    // matcher: '/api/:path*'
    const single = code.match(/matcher\s*:\s*['"]([^'"]+)['"]/);
    if (single) patterns.push(single[1]);
  }

  return { filePath: mw.path, hasAuth, matcherPatterns: patterns };
}

/**
 * Simplified middleware matcher coverage check.
 * Converts patterns like `/api/:path*` → prefix `/api` and tests if
 * the route path starts with that prefix.
 */
function isRouteCoveredByMiddleware(
  routePath: string,
  patterns: string[]
): boolean {
  if (patterns.length === 0) return false;
  return patterns.some((pattern) => {
    const prefix =
      pattern
        .replace(/\(\?.*?\)/g, "")
        .replace(/:[\w]+\*/g, "")
        .replace(/:[\w]+/g, "_placeholder_")
        .split("_placeholder_")[0]
        .replace(/\/$/, "") || "/";
    return (
      routePath === prefix ||
      routePath.startsWith(prefix + "/") ||
      routePath.startsWith(prefix + "[")
    );
  });
}

function isPublicPath(routePath: string): boolean {
  return /\/auth\/|\/webhooks?\/|\/public\/|\/health\b|\/ping\b|\/oauth\//.test(
    routePath
  );
}

// ─── Rule 1: IDOR ─────────────────────────────────────────────────────────────

function detectIDOR(routes: RouteInfo[]): Finding[] {
  const findings: Finding[] = [];

  for (const route of routes) {
    if (route.paramNames.length === 0) continue;

    // Route must query the DB using the dynamic ID param
    const idQueryOps = route.prismaOps.filter(
      (op) =>
        ["findUnique", "findFirst", "update", "delete", "upsert"].includes(
          op.method
        ) && op.hasWhereId
    );
    if (idQueryOps.length === 0) continue;

    // If ownership is already checked, no IDOR
    if (route.hasOwnershipCheck) continue;

    // If there's no auth at all, missing-auth-api already catches it — skip
    if (!route.hasAuth) continue;

    const op = idQueryOps[0];
    const paramName = route.paramNames[0];

    findings.push({
      ruleId: "graph-idor",
      filePath: route.filePath,
      lineNumber: op.lineNumber,
      lineEnd: op.lineNumber,
      codeSnippet: `prisma.${op.model}.${op.method}({ where: { id: params.${paramName} } })`,
      severity: "CRITICAL",
      category: "authorization",
      title: "IDOR: Resource queried by ID without ownership verification",
      description:
        `Route \`${route.routePath}\` uses \`params.${paramName}\` in a Prisma query but never checks that the record belongs to the authenticated user (\`createdById\`, \`userId\`, etc.). ` +
        `Any authenticated user can read or mutate another user's data by guessing or enumerating IDs. ` +
        `This is the #1 vulnerability AI coding tools introduce — they generate route handlers that are authenticated but not authorised.`,
      aiTools: ["cursor", "copilot", "v0", "bolt", "lovable", "replit"],
      fixTemplate:
        `// Add the user ownership filter to your Prisma query:\n` +
        `const record = await prisma.${op.model}.${op.method}({\n` +
        `  where: { id: params.${paramName}, createdById: session.user.id },\n` +
        `});\n` +
        `if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });`,
    });
  }

  return findings;
}

// ─── Rule 2: Server action auth bypass ───────────────────────────────────────

function detectServerActionAuthBypass(
  actions: ServerActionInfo[]
): Finding[] {
  return actions
    .filter((a) => a.hasPrismaWrite && !a.hasAuth)
    .map((a) => ({
      ruleId: "graph-server-action-no-auth",
      filePath: a.filePath,
      lineNumber: a.lineNumber,
      lineEnd: a.lineNumber,
      codeSnippet: `export async function ${a.functionName}(...)`,
      severity: "CRITICAL",
      category: "authentication",
      title: `Server action '${a.functionName}' writes to database without authentication`,
      description:
        `The server action \`${a.functionName}\` in \`${a.filePath}\` performs a database write but does not call \`auth()\` or any equivalent check. ` +
        `Server actions are callable directly via POST from any browser — without auth they are fully open write endpoints. ` +
        `AI coding assistants routinely generate server actions that skip this step.`,
      aiTools: ["cursor", "copilot", "v0", "bolt", "lovable", "replit"],
      fixTemplate:
        `// Add at the top of ${a.functionName}:\n` +
        `const session = await auth();\n` +
        `if (!session?.user?.id) throw new Error("Unauthorized");`,
    }));
}

// ─── Rule 3: Middleware coverage gap ─────────────────────────────────────────

function detectMiddlewareCoverageGaps(
  routes: RouteInfo[],
  middleware: MiddlewareInfo
): Finding[] {
  if (!middleware.filePath || middleware.matcherPatterns.length === 0)
    return [];

  const findings: Finding[] = [];

  for (const route of routes) {
    // Only care about API mutation routes
    if (!route.routePath.startsWith("/api/")) continue;
    const mutationMethods = route.methods.filter((m) =>
      ["POST", "PUT", "PATCH", "DELETE"].includes(m)
    );
    if (mutationMethods.length === 0) continue;
    // Route has inline auth — fine
    if (route.hasAuth) continue;
    // Route is covered by middleware AND middleware has auth — fine
    if (
      isRouteCoveredByMiddleware(
        route.routePath,
        middleware.matcherPatterns
      ) &&
      middleware.hasAuth
    )
      continue;
    // Skip intentionally public paths
    if (isPublicPath(route.routePath)) continue;

    findings.push({
      ruleId: "graph-middleware-gap",
      filePath: route.filePath,
      lineNumber: 1,
      lineEnd: 1,
      codeSnippet: `export async function ${mutationMethods[0]}(req, { params }) { ... }`,
      severity: "HIGH",
      category: "authentication",
      title: `Mutation route not protected by middleware or inline auth`,
      description:
        `\`${route.routePath}\` handles ${mutationMethods.join("/")} requests. ` +
        `It has no inline \`auth()\` call and is not covered by the middleware matcher ` +
        `(patterns: ${middleware.matcherPatterns.slice(0, 3).join(", ")}). ` +
        `This is a blind spot that cross-file analysis can identify but file-by-file scanning cannot — ` +
        `the route looks fine in isolation, but in context of the middleware config it is unprotected.`,
      aiTools: ["cursor", "copilot", "v0", "bolt", "lovable", "replit"],
      fixTemplate:
        `// Option A — add this path to the middleware matcher:\n` +
        `matcher: ['${route.routePath}/:path*', ...existingPatterns]\n\n` +
        `// Option B — add inline auth at the top of the handler:\n` +
        `const session = await auth();\n` +
        `if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`,
    });
  }

  return findings;
}

// ─── Rule 4: Mass assignment ──────────────────────────────────────────────────

function detectMassAssignment(routes: RouteInfo[]): Finding[] {
  const findings: Finding[] = [];

  for (const route of routes) {
    if (!route.hasMassAssignment) continue;

    const op = route.prismaOps.find(
      (o) =>
        ["create", "update", "upsert"].includes(o.method) && o.fromBodyDirect
    );
    if (!op) continue;

    findings.push({
      ruleId: "graph-mass-assignment",
      filePath: route.filePath,
      lineNumber: op.lineNumber,
      lineEnd: op.lineNumber,
      codeSnippet: `await prisma.${op.model}.${op.method}({ data: body })`,
      severity: "HIGH",
      category: "injection",
      title: "Mass assignment: raw request body passed to Prisma write",
      description:
        `Route \`${route.routePath}\` spreads or directly passes the parsed request body into \`prisma.${op.model}.${op.method}\`. ` +
        `An attacker can inject arbitrary fields such as \`role\`, \`isAdmin\`, \`createdById\`, or \`planTier\` and silently overwrite them in the database. ` +
        `AI tools frequently generate this pattern as it looks concise and "works".`,
      aiTools: ["cursor", "copilot", "v0", "bolt", "lovable", "replit"],
      fixTemplate:
        `// Explicitly allowlist only the fields you intend to write:\n` +
        `const { title, description } = await req.json();\n` +
        `await prisma.${op.model}.${op.method}({\n` +
        `  where: { id: params.id, createdById: session.user.id },\n` +
        `  data: { title, description },\n` +
        `});`,
    });
  }

  return findings;
}

// ─── Rule 5: Server secrets leaked into client bundle via import ──────────────

function detectSecretsInClientImports(files: FileEntry[]): Finding[] {
  const findings: Finding[] = [];

  // Build set of server-side file paths that use non-public env vars
  const serverSecretFiles = new Set<string>();
  for (const file of files) {
    // Not a client component
    if (/^\s*['"]use client['"]/m.test(file.content)) continue;
    // Uses a non-NEXT_PUBLIC_ env var (server secret)
    if (/process\.env\.(?!NEXT_PUBLIC_)[A-Z_]{3,}/.test(file.content)) {
      serverSecretFiles.add(file.path);
    }
  }

  if (serverSecretFiles.size === 0) return findings;

  // Normalise a module specifier to a canonical path fragment for matching
  function normalise(spec: string): string {
    return spec
      .replace(/^@\//, "src/")
      .replace(/\.[jt]sx?$/, "")
      .replace(/\/index$/, "");
  }

  const clientFiles = files.filter((f) =>
    /^\s*['"]use client['"]/m.test(f.content)
  );

  for (const clientFile of clientFiles) {
    const importRe =
      /import\s+[^'"]+from\s+['"](@\/[^'"]+|\.\.?\/[^'"]+)['"]/g;
    let m: RegExpExecArray | null;

    while ((m = importRe.exec(clientFile.content)) !== null) {
      const spec = m[1];
      const normSpec = normalise(spec);

      const matched = [...serverSecretFiles].find((sf) => {
        const normSf = normalise(sf);
        return normSf.endsWith(normSpec) || normSf.includes(normSpec);
      });

      if (matched) {
        const lineNumber =
          clientFile.content.slice(0, m.index).split("\n").length;

        findings.push({
          ruleId: "graph-secret-in-client-import",
          filePath: clientFile.path,
          lineNumber,
          lineEnd: lineNumber,
          codeSnippet: m[0],
          severity: "HIGH",
          category: "data-exposure",
          title:
            "Client component imports module that contains server-side secrets",
          description:
            `\`${clientFile.path}\` imports from \`${spec}\`, which uses non-public \`process.env\` variables. ` +
            `Next.js may inline these values into the client JavaScript bundle, leaking secrets (API keys, DB URLs, tokens) to the browser. ` +
            `This cross-file pattern is invisible to per-file scanners — each file looks fine on its own.`,
          aiTools: ["cursor", "copilot", "v0", "bolt", "lovable", "replit"],
          fixTemplate:
            `// Move secret-accessing code to a server component, API route, or server action.\n` +
            `// Replace the direct import with an API call or a server component prop:\n` +
            `// In a Server Component: pass only the derived (non-secret) data as props.\n` +
            `// In a Client Component: fetch the result from an API route — never import the module.`,
        });
        break; // one finding per client file is enough
      }
    }
  }

  return findings;
}

// ─── Rule 6: Missing CAPTCHA on authentication pages ─────────────────────────

function detectMissingCaptcha(files: FileEntry[]): Finding[] {
  // Check if any CAPTCHA library is imported anywhere in the project
  const captchaRe =
    /hcaptcha|@hcaptcha|recaptcha|react-google-recaptcha|turnstile|@cloudflare\/turnstile|react-turnstile|react-simple-captcha|friendly-captcha/i;
  const hasCaptcha = files.some((f) => captchaRe.test(f.content));
  if (hasCaptcha) return [];

  // Find auth-related page or route files
  const authPathRe =
    /\/(login|signin|sign-in|register|signup|sign-up|forgot-password|reset-password|auth)\//i;
  const authFiles = files.filter(
    (f) =>
      authPathRe.test(f.path) &&
      /(?:page|route)\.[jt]sx?$/.test(f.path)
  );
  if (authFiles.length === 0) return [];

  const examplePaths = authFiles
    .slice(0, 3)
    .map((f) => f.path)
    .join(", ");

  return [
    {
      ruleId: "graph-missing-captcha",
      filePath: authFiles[0].path,
      lineNumber: 1,
      lineEnd: 1,
      codeSnippet: `// No CAPTCHA found across ${authFiles.length} auth page(s)`,
      severity: "MEDIUM",
      category: "authentication",
      title: "No CAPTCHA protection on authentication forms",
      description:
        `Auth pages detected (${examplePaths}) but no CAPTCHA library ` +
        `(hCaptcha, reCAPTCHA v3, Cloudflare Turnstile) was found anywhere in the codebase. ` +
        `Without CAPTCHA, login and signup forms are exposed to credential stuffing, brute-force password spraying, ` +
        `and bot-driven account creation at scale. AI tools never add CAPTCHA unless explicitly instructed.`,
      aiTools: ["cursor", "copilot", "v0", "bolt", "lovable", "replit"],
      fixTemplate:
        `# Install a CAPTCHA library (Cloudflare Turnstile is recommended — free, privacy-friendly):\nnpm install react-turnstile\n\n` +
        `# Add to your login/signup form:\nimport Turnstile from 'react-turnstile';\n` +
        `// <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onSuccess={setToken} />\n` +
        `# Verify on the server:\n// await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { ... })`,
    },
  ];
}

// ─── Rule 7: Missing security headers in next.config ─────────────────────────

function detectMissingSecurityHeaders(files: FileEntry[]): Finding[] {
  const configFile = files.find((f) =>
    /(?:^|\/)next\.config\.[mc]?[jt]s$/.test(f.path)
  );
  if (!configFile) return [];

  const code = configFile.content;

  // If no headers() function at all, everything is missing
  const hasHeadersFn =
    /\basync\s+headers\s*\(|headers\s*:\s*(?:async\s+)?\(\s*\)\s*=>/.test(
      code
    );

  if (!hasHeadersFn) {
    return [
      {
        ruleId: "graph-missing-security-headers",
        filePath: configFile.path,
        lineNumber: 1,
        lineEnd: 1,
        codeSnippet: `// next.config: no security headers() configured`,
        severity: "MEDIUM",
        category: "configuration",
        title: "Security headers not configured in next.config",
        description:
          `\`next.config\` does not define a \`headers()\` function. ` +
          `Critical browser security headers (Content-Security-Policy, X-Frame-Options, ` +
          `X-Content-Type-Options, Strict-Transport-Security, Permissions-Policy) are never sent, ` +
          `leaving the app exposed to clickjacking, MIME sniffing attacks, protocol downgrade, and XSS. ` +
          `This is consistently missed by AI-generated projects.`,
        aiTools: ["cursor", "copilot", "v0", "bolt", "lovable", "replit"],
        fixTemplate:
          `// Add to next.config.js:\nasync headers() {\n  return [{\n    source: '/(.*)',\n    headers: [\n` +
          `      { key: 'X-Frame-Options', value: 'DENY' },\n` +
          `      { key: 'X-Content-Type-Options', value: 'nosniff' },\n` +
          `      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },\n` +
          `      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },\n` +
          `      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },\n` +
          `      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'" },\n` +
          `    ],\n  }];\n}`,
      },
    ];
  }

  // headers() exists — check for specific missing headers
  const headerChecks: { header: string; pattern: RegExp }[] = [
    { header: "X-Frame-Options", pattern: /X-Frame-Options/i },
    { header: "X-Content-Type-Options", pattern: /X-Content-Type-Options/i },
    {
      header: "Strict-Transport-Security",
      pattern: /Strict-Transport-Security/i,
    },
    { header: "Permissions-Policy", pattern: /Permissions-Policy/i },
    { header: "Content-Security-Policy", pattern: /Content-Security-Policy/i },
  ];

  const missingHeaders = headerChecks
    .filter(({ pattern }) => !pattern.test(code))
    .map(({ header }) => header);

  if (missingHeaders.length === 0) return [];

  return [
    {
      ruleId: "graph-incomplete-security-headers",
      filePath: configFile.path,
      lineNumber: 1,
      lineEnd: 1,
      codeSnippet: `// Missing: ${missingHeaders.join(", ")}`,
      severity: "LOW",
      category: "configuration",
      title: `Incomplete security headers: missing ${missingHeaders.slice(0, 3).join(", ")}`,
      description:
        `\`next.config\` has a \`headers()\` function but is missing: ${missingHeaders.join(", ")}. ` +
        `These headers defend against clickjacking (X-Frame-Options), MIME-type sniffing (X-Content-Type-Options), ` +
        `protocol downgrade attacks (HSTS), and capability abuse (Permissions-Policy).`,
      aiTools: [],
      fixTemplate: missingHeaders
        .map((h) => `{ key: '${h}', value: '...' }`)
        .join(",\n"),
    },
  ];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse the full project graph and return cross-file security findings.
 * Call this AFTER per-file scanning and merge the results.
 */
export function analyzeProjectGraph(files: FileEntry[]): Finding[] {
  const routes = files
    .map(parseRouteFile)
    .filter((r): r is RouteInfo => r !== null);

  const serverActions = files.flatMap(parseServerActions);
  const middleware = parseMiddleware(files);

  const findings: Finding[] = [
    ...detectIDOR(routes),
    ...detectServerActionAuthBypass(serverActions),
    ...detectMiddlewareCoverageGaps(routes, middleware),
    ...detectMassAssignment(routes),
    ...detectSecretsInClientImports(files),
    ...detectMissingCaptcha(files),
    ...detectMissingSecurityHeaders(files),
  ];

  // Deduplicate
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.ruleId}:${f.filePath}:${f.lineNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
