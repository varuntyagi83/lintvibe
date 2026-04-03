import type { RawRule } from "../../src/lib/engine/types";

// Bundled copy of all VibeScan detection rules — no database required.
// Keep in sync with prisma/seed.ts.

export const RULES: RawRule[] = [
  // ── Secrets & credentials ──────────────────────────────────────────────────
  {
    id: "hardcoded-api-key",
    category: "secrets",
    severity: "CRITICAL",
    title: "Hardcoded API key in source",
    description:
      "An API key is hardcoded directly in source code. If this repository is ever public or shared, the key is compromised instantly.",
    patternType: "REGEX",
    pattern: { regex: "(api[_-]?key|apikey)\\s*[:=]\\s*['\"][A-Za-z0-9_\\-]{20,}['\"]" },
    languages: ["javascript", "typescript", "python"],
    aiTools: ["copilot", "cursor", "lovable", "bolt", "claude-code"],
    fixTemplate: "Move the key to an environment variable: `const apiKey = process.env.API_KEY`",
    enabled: true,
  },
  {
    id: "hardcoded-secret",
    category: "secrets",
    severity: "CRITICAL",
    title: "Hardcoded secret or password",
    description:
      "A secret, password, or token is hardcoded in source. This is a critical vulnerability — credentials in code can be extracted by anyone with repo access.",
    patternType: "REGEX",
    pattern: {
      regex:
        "(?:secret|password|passwd|auth_token)\\s*[:=]\\s*['\"](?!your[_-]|replace|example|placeholder|xxx|000|env\\.|process\\.)[^'\"]{8,}['\"]",
    },
    languages: ["javascript", "typescript", "python"],
    aiTools: ["copilot", "cursor"],
    fixTemplate: "Use environment variables: `const secret = process.env.SECRET`",
    enabled: true,
  },
  {
    id: "supabase-key-client",
    category: "secrets",
    severity: "CRITICAL",
    title: "Supabase service role key in client bundle",
    description:
      "The Supabase service role key bypasses Row Level Security. Including it in client-side code exposes your entire database to any user.",
    patternType: "AST",
    pattern: { identifier: "SUPABASE_SERVICE_ROLE_KEY", context: "client" },
    languages: ["javascript", "typescript"],
    aiTools: ["lovable", "bolt"],
    fixTemplate:
      "Service role keys must only be used in server-side API routes, never in components or client code.",
    enabled: true,
  },
  {
    id: "env-in-client",
    category: "secrets",
    severity: "HIGH",
    title: "Server environment variable exposed in client-side code",
    description:
      "process.env variables without the NEXT_PUBLIC_ prefix are server-only. Using them in client components leaks them to the browser bundle.",
    patternType: "AST",
    pattern: { call: "process.env", context: "client-component" },
    languages: ["javascript", "typescript"],
    aiTools: ["copilot", "cursor", "lovable", "bolt", "claude-code"],
    fixTemplate:
      "Prefix public variables with NEXT_PUBLIC_ or move the logic to a server component / API route.",
    enabled: true,
  },
  {
    id: "default-admin",
    category: "auth",
    severity: "CRITICAL",
    title: "Default admin credentials",
    description: "Default or hardcoded admin credentials are present. These are the first thing attackers try.",
    patternType: "REGEX",
    pattern: {
      regex:
        "password\\s*[:=]\\s*['\"](?:admin|password|pass|123456|admin123|test|default|root|1234|qwerty|letmein|welcome|changeme)['\"]|DEFAULT_ADMIN_PASS(?:WORD)?\\s*=\\s*['\"][^'\"]+['\"]",
    },
    languages: ["javascript", "typescript", "python"],
    aiTools: ["copilot"],
    fixTemplate: "Remove all default credentials. Require secure passwords during setup.",
    enabled: true,
  },

  // ── Authentication & authorisation ─────────────────────────────────────────
  {
    id: "missing-auth-api",
    category: "auth",
    severity: "CRITICAL",
    title: "API route without authentication check",
    description:
      "This API route handler has no authentication check. Any unauthenticated user can call this endpoint, potentially accessing or modifying protected data.",
    patternType: "AST",
    pattern: { node: "ExportedFunction", missing: ["getServerSession", "auth()", "getUser", "currentUser"] },
    languages: ["javascript", "typescript"],
    aiTools: ["lovable", "bolt"],
    fixTemplate:
      "Add auth check at the top of the handler: `const session = await auth(); if (!session) return new Response('Unauthorized', { status: 401 });`",
    enabled: true,
  },
  {
    id: "missing-rls",
    category: "auth",
    severity: "HIGH",
    title: "Supabase query without RLS context",
    description:
      "A Supabase query is made using the service role or without proper RLS context, potentially exposing data across tenant boundaries.",
    patternType: "AST",
    pattern: { call: "supabase.from", context: "server", missingAuth: true },
    languages: ["javascript", "typescript"],
    aiTools: ["lovable", "bolt"],
    fixTemplate:
      "Use the authenticated Supabase client: `const supabase = createServerClient(...)` with proper cookie forwarding.",
    enabled: true,
  },
  {
    id: "jwt-no-verify",
    category: "auth",
    severity: "CRITICAL",
    title: "JWT decoded without verification",
    description:
      "jwt.decode() does not verify the token signature — it only base64-decodes the payload. An attacker can craft any payload and it will be trusted.",
    patternType: "AST",
    pattern: { call: "jwt.decode", missingPair: "jwt.verify" },
    languages: ["javascript", "typescript"],
    aiTools: ["copilot", "cursor"],
    fixTemplate: "Replace jwt.decode() with jwt.verify(token, secret) which validates the signature.",
    enabled: true,
  },
  {
    id: "no-csrf",
    category: "auth",
    severity: "MEDIUM",
    title: "Form POST without CSRF protection",
    description:
      "A form submits via POST without CSRF token validation. This allows cross-site request forgery attacks where malicious sites trigger actions on behalf of authenticated users.",
    patternType: "AST",
    pattern: { node: "form", method: "POST", missing: "csrf" },
    languages: ["javascript", "typescript"],
    aiTools: ["lovable", "bolt"],
    fixTemplate:
      "Add CSRF protection using a library like csrf-csrf or use Next.js Server Actions which have built-in CSRF protection.",
    enabled: true,
  },

  // ── Injection ──────────────────────────────────────────────────────────────
  {
    id: "sql-interpolation",
    category: "injection",
    severity: "CRITICAL",
    title: "SQL query with string interpolation",
    description:
      "User-controlled input is interpolated directly into a SQL query. This is a textbook SQL injection vulnerability allowing an attacker to read, modify, or delete any data.",
    patternType: "AST",
    pattern: { call: ["query", "raw", "execute"], argType: "TemplateLiteral" },
    languages: ["javascript", "typescript", "python"],
    aiTools: ["copilot", "cursor"],
    fixTemplate: "Use parameterised queries: `db.query('SELECT * FROM users WHERE id = $1', [userId])`",
    enabled: true,
  },
  {
    id: "nosql-injection",
    category: "injection",
    severity: "HIGH",
    title: "NoSQL query with unsanitised input",
    description:
      "Request body or query params are passed directly to a MongoDB query. An attacker can inject query operators ($where, $gt) to bypass filters or dump data.",
    patternType: "AST",
    pattern: { call: ["find", "findOne", "updateOne", "deleteOne"], argSource: ["req.body", "req.query"] },
    languages: ["javascript", "typescript"],
    aiTools: ["copilot"],
    fixTemplate:
      "Validate and sanitise inputs with zod before passing to MongoDB. Never spread req.body directly into a query.",
    enabled: true,
  },
  {
    id: "xss-dangerously",
    category: "injection",
    severity: "HIGH",
    title: "dangerouslySetInnerHTML with user-controlled input",
    description:
      "dangerouslySetInnerHTML bypasses React's XSS protection. If the value is user-controlled, an attacker can inject arbitrary scripts.",
    patternType: "AST",
    pattern: { prop: "dangerouslySetInnerHTML", valueSource: ["props", "state", "api"] },
    languages: ["javascript", "typescript"],
    aiTools: ["lovable", "bolt"],
    fixTemplate:
      "Use DOMPurify to sanitise HTML before rendering, or refactor to avoid dangerouslySetInnerHTML entirely.",
    enabled: true,
  },
  {
    id: "eval-usage",
    category: "injection",
    severity: "HIGH",
    title: "eval() or Function() with dynamic input",
    description:
      "eval() executes arbitrary code. Any user-controlled input passed to eval() is a remote code execution vulnerability.",
    patternType: "AST",
    pattern: { call: ["eval", "new Function", "setTimeout"], argType: "dynamic" },
    languages: ["javascript", "typescript"],
    aiTools: ["copilot"],
    fixTemplate: "Never use eval(). Use JSON.parse() for data, or refactor logic to avoid dynamic code execution.",
    enabled: true,
  },
  {
    id: "command-injection",
    category: "injection",
    severity: "CRITICAL",
    title: "Shell command with unsanitised input",
    description:
      "User input is passed to a shell command via exec/spawn/execSync. An attacker can inject shell metacharacters to run arbitrary commands on the server.",
    patternType: "AST",
    pattern: { call: ["exec", "execSync", "spawn", "spawnSync"], argType: "TemplateLiteral" },
    languages: ["javascript", "typescript"],
    aiTools: ["claude-code"],
    fixTemplate:
      "Use spawn() with an args array (never shell: true), or use a library that avoids shell invocation entirely.",
    enabled: true,
  },

  // ── CORS & headers ────────────────────────────────────────────────────────
  {
    id: "cors-wildcard",
    category: "cors",
    severity: "HIGH",
    title: "CORS allows all origins",
    description:
      "Access-Control-Allow-Origin: * permits any website to make cross-origin requests to your API, enabling CSRF-style attacks on authenticated endpoints.",
    patternType: "REGEX",
    pattern: { regex: "Access-Control-Allow-Origin.*\\*|cors\\(\\s*\\{\\s*origin:\\s*true" },
    languages: ["javascript", "typescript"],
    aiTools: ["copilot", "cursor", "lovable", "bolt", "claude-code"],
    fixTemplate: "Set an allowlist: `cors({ origin: ['https://yourdomain.com'] })`",
    enabled: true,
  },
  {
    id: "cors-credentials-wildcard",
    category: "cors",
    severity: "CRITICAL",
    title: "CORS with credentials and wildcard origin",
    description:
      "Combining credentials:true with a wildcard origin is rejected by browsers but misconfigurations here can still enable session hijacking in some setups.",
    patternType: "AST",
    pattern: { corsConfig: { credentials: true, origin: ["*", "true"] } },
    languages: ["javascript", "typescript"],
    aiTools: ["copilot", "cursor"],
    fixTemplate:
      "When using credentials:true, you must specify an explicit origin, never a wildcard.",
    enabled: true,
  },
  {
    id: "no-rate-limit",
    category: "cors",
    severity: "MEDIUM",
    title: "API routes without rate limiting",
    description:
      "No rate limiting on this API route means it can be brute-forced or abused for denial of service.",
    patternType: "AST",
    pattern: { node: "RouteHandler", missing: ["rateLimit", "rateLimiter", "upstash"] },
    languages: ["javascript", "typescript"],
    aiTools: ["copilot", "cursor", "lovable", "bolt", "claude-code"],
    fixTemplate:
      "Add rate limiting using Upstash Redis or the `rate-limiter-flexible` package.",
    enabled: true,
  },

  // ── Data exposure ──────────────────────────────────────────────────────────
  {
    id: "full-error-client",
    category: "data-exposure",
    severity: "HIGH",
    title: "Full error stack trace sent to client",
    description:
      "Sending error.stack or error.message directly to the client reveals implementation details (file paths, library versions, database schema) that help attackers craft targeted attacks.",
    patternType: "AST",
    pattern: { node: "catch", responseContains: ["error.stack", "error.message", "e.stack"] },
    languages: ["javascript", "typescript"],
    aiTools: ["copilot", "cursor", "lovable", "bolt", "claude-code"],
    fixTemplate:
      "Log errors server-side, return only a generic message: `return NextResponse.json({ error: 'Internal server error' }, { status: 500 })`",
    enabled: true,
  },
  {
    id: "console-log-sensitive",
    category: "data-exposure",
    severity: "MEDIUM",
    title: "console.log with sensitive variable",
    description:
      "Logging sensitive data (passwords, tokens, keys) can expose it in server logs, browser consoles, or observability tools.",
    patternType: "AST",
    pattern: {
      call: "console.log",
      argContains: ["password", "token", "secret", "key", "credential", "apiKey"],
    },
    languages: ["javascript", "typescript"],
    aiTools: ["copilot", "claude-code"],
    fixTemplate: "Remove the log statement, or redact sensitive fields before logging.",
    enabled: true,
  },
  {
    id: "unfiltered-query",
    category: "data-exposure",
    severity: "MEDIUM",
    title: "Database results returned without field filtering",
    description:
      "SELECT * followed by a direct API response exposes all columns including internal fields, hashed passwords, or soft-deleted records.",
    patternType: "AST",
    pattern: { call: "select('*')", directResponse: true },
    languages: ["javascript", "typescript"],
    aiTools: ["lovable", "bolt"],
    fixTemplate:
      "Explicitly select only the fields you need, or use a serialiser to strip sensitive fields before returning.",
    enabled: true,
  },
  {
    id: "debug-mode-prod",
    category: "data-exposure",
    severity: "HIGH",
    title: "Debug mode enabled in production config",
    description:
      "Debug mode in production can expose stack traces, query plans, or internal state to end users.",
    patternType: "REGEX",
    pattern: { regex: "DEBUG\\s*=\\s*true|debug:\\s*true" },
    languages: ["javascript", "typescript", "python"],
    aiTools: ["copilot", "cursor", "lovable", "bolt", "claude-code"],
    fixTemplate:
      "Gate debug mode behind NODE_ENV checks: `debug: process.env.NODE_ENV === 'development'`",
    enabled: true,
  },

  // ── Config ─────────────────────────────────────────────────────────────────
  {
    id: "no-input-validation",
    category: "config",
    severity: "HIGH",
    title: "API endpoint without input validation",
    description:
      "Request body or query params are used without schema validation. This can lead to type confusion, unexpected behaviour, or injection vulnerabilities.",
    patternType: "AST",
    pattern: {
      argSource: ["req.body", "req.query", "request.json()"],
      missingValidation: true,
    },
    languages: ["javascript", "typescript"],
    aiTools: ["copilot", "cursor", "lovable", "bolt", "claude-code"],
    fixTemplate:
      "Validate all inputs with zod: `const body = RequestSchema.parse(await request.json())`",
    enabled: true,
  },
  {
    id: "unvalidated-redirect",
    category: "config",
    severity: "HIGH",
    title: "Redirect using user-supplied URL",
    description:
      "Redirecting to a user-controlled URL enables open redirect attacks, which are used to phish users or bypass security filters.",
    patternType: "AST",
    pattern: {
      call: ["redirect", "router.push", "Response.redirect"],
      argSource: ["searchParams", "req.query", "req.body"],
    },
    languages: ["javascript", "typescript"],
    aiTools: ["lovable", "bolt"],
    fixTemplate:
      "Validate the redirect URL against an allowlist of trusted domains before redirecting.",
    enabled: true,
  },
  {
    id: "insecure-cookie",
    category: "config",
    severity: "MEDIUM",
    title: "Cookie set without secure flags",
    description:
      "Cookies without httpOnly, secure, and sameSite flags can be read by JavaScript (XSS theft), sent over HTTP (interception), or included in cross-site requests (CSRF).",
    patternType: "AST",
    pattern: {
      call: ["setCookie", "cookies().set", "res.cookie"],
      missingFlags: ["httpOnly", "secure", "sameSite"],
    },
    languages: ["javascript", "typescript"],
    aiTools: ["copilot"],
    fixTemplate:
      "Set all three flags: `cookies().set('name', value, { httpOnly: true, secure: true, sameSite: 'lax' })`",
    enabled: true,
  },
];
