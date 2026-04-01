# PRD: VibeScan — AI-Generated Code Security Scanner

> **Product Name:** VibeScan
> **Author:** Varun Tyagi
> **Date:** March 30, 2026
> **Build Tool:** Claude Code (Ralph Loop methodology)
> **Status:** Ready for Phase 1

---

## 1. Product vision

AI-generated code has 1.7x more security vulnerabilities than human-written code. Amazon had production outages traced to AI-assisted code changes. Copilot, Cursor, Claude Code, Lovable, and Bolt all generate code with known, repeatable vulnerability patterns — but no existing scanner is tuned specifically for these patterns.

VibeScan is a security scanner built specifically for vibe-coded applications. It detects the antipatterns that AI code generators consistently introduce: hardcoded secrets, overpermissive CORS, SQL injection via string interpolation, missing auth checks on API routes, exposed environment variables in client bundles, default admin credentials, unvalidated redirects, and more.

**Why Varun builds this:** He has shipped production apps with Lovable, Bolt, Claude Code, and Cursor. He knows exactly which patterns each tool produces and where they break.

---

## 2. Target users

- Solo developers and founders who vibe-code their apps and need a security check before launch
- Development teams using AI coding assistants (Copilot, Cursor, Claude Code) in their workflow
- Code reviewers who need to catch AI-specific antipatterns that traditional SAST tools miss
- Agencies building apps for clients with AI tools and needing to demonstrate security diligence
- AI Catalyst cohort members shipping their first production apps

---

## 3. Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router), Tailwind CSS, shadcn/ui |
| Backend | Next.js API routes + Supabase Edge Functions |
| Database | Supabase (PostgreSQL) with Row Level Security |
| Auth | Supabase Auth (email + GitHub SSO) |
| AI analysis | Claude API (claude-sonnet-4-20250514) for contextual vulnerability explanation |
| Code parsing | Tree-sitter (AST parsing for JS/TS/Python), custom regex patterns for config files |
| File handling | Supabase Storage for uploaded projects, zip extraction |
| Deployment | Vercel (frontend) + Supabase (backend) |
| CI/CD integration | GitHub App for PR scanning (Phase 3) |

---

## 4. Database schema

```sql
-- organisations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free','pro','enterprise'))
);

-- users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT,
  org_id UUID REFERENCES organizations(id),
  role TEXT DEFAULT 'member' CHECK (role IN ('admin','member','viewer')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- scans
CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL, -- project name or repo name
  source_type TEXT NOT NULL CHECK (source_type IN ('upload','github','paste')),
  source_ref TEXT, -- github repo URL or upload filename
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','scanning','complete','failed')),
  file_count INT DEFAULT 0,
  lines_scanned INT DEFAULT 0,
  scan_duration_ms INT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- findings
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  line_number INT,
  line_end INT,
  code_snippet TEXT, -- 3-5 lines of context
  rule_id TEXT NOT NULL, -- e.g. 'hardcoded-secret', 'missing-auth'
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  category TEXT NOT NULL, -- e.g. 'secrets', 'auth', 'injection', 'cors', 'env-exposure'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  ai_explanation TEXT, -- Claude-generated contextual explanation
  fix_suggestion TEXT, -- Claude-generated fix
  fixed BOOLEAN DEFAULT false,
  false_positive BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- scan_summary (denormalised for fast dashboard)
CREATE TABLE scan_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID UNIQUE REFERENCES scans(id) ON DELETE CASCADE,
  total_findings INT DEFAULT 0,
  critical_count INT DEFAULT 0,
  high_count INT DEFAULT 0,
  medium_count INT DEFAULT 0,
  low_count INT DEFAULT 0,
  info_count INT DEFAULT 0,
  top_categories JSONB DEFAULT '[]', -- [{category, count}]
  risk_score FLOAT DEFAULT 0, -- 0-100
  grade TEXT, -- A/B/C/D/F
  created_at TIMESTAMPTZ DEFAULT now()
);

-- rules (the detection rule library)
CREATE TABLE rules (
  id TEXT PRIMARY KEY, -- e.g. 'hardcoded-secret'
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('regex','ast','semantic')),
  pattern JSONB NOT NULL, -- regex string or AST query
  languages TEXT[] NOT NULL, -- ['javascript','typescript','python']
  ai_tools TEXT[], -- which AI tools commonly produce this: ['copilot','lovable','bolt','cursor','claude-code']
  fix_template TEXT, -- template for auto-fix suggestion
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
-- org_id scoped policies
-- Index on findings(scan_id, severity), scans(org_id, status)
```

---

## 5. Detection rules library (seed data)

These are the rules VibeScan ships with on day one. Each is a real pattern observed in AI-generated code.

### 5.1 Secrets & credentials

| Rule ID | Title | Pattern | AI tools that produce this |
|---------|-------|---------|--------------------------|
| `hardcoded-api-key` | Hardcoded API key in source | Regex: `(api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]` | All tools |
| `hardcoded-secret` | Hardcoded secret/password | Regex: `(secret|password|passwd|token)\s*[:=]\s*['"][^'"]{8,}['"]` | Copilot, Cursor |
| `supabase-key-client` | Supabase service role key in client bundle | AST: import of `SUPABASE_SERVICE_ROLE_KEY` in files under `/app`, `/pages`, `/components` | Lovable, Bolt |
| `env-in-client` | Environment variable exposed in client-side code | AST: `process.env.` in files that render in browser (not API routes) | All tools |
| `dotenv-committed` | .env file in repository | File presence: `.env`, `.env.local`, `.env.production` without `.gitignore` entry | Claude Code, Cursor |

### 5.2 Authentication & authorisation

| Rule ID | Title | Pattern | AI tools |
|---------|-------|---------|----------|
| `missing-auth-api` | API route without authentication check | AST: Next.js API route handler (`export function GET/POST`) without `getServerSession`, `auth()`, or `supabase.auth.getUser()` call | Lovable, Bolt |
| `missing-rls` | Supabase query without RLS context | AST: `supabase.from().select/insert/update/delete` without `.auth` header or `anon` key warning | Lovable, Bolt |
| `default-admin` | Default admin credentials | Regex: `admin.*password.*['"]admin` or hardcoded user creation with simple passwords | Copilot |
| `jwt-no-verify` | JWT used without verification | AST: `jwt.decode()` without `jwt.verify()` | Copilot, Cursor |
| `no-csrf` | Form submission without CSRF protection | AST: HTML form with POST action but no CSRF token field or header | Lovable, Bolt |

### 5.3 Injection

| Rule ID | Title | Pattern | AI tools |
|---------|-------|---------|----------|
| `sql-interpolation` | SQL query with string interpolation | AST: template literal or string concat inside `.query()`, `.raw()`, or SQL tagged template | Copilot, Cursor |
| `nosql-injection` | MongoDB query with unsanitised input | AST: `req.body` or `req.query` passed directly to `.find()`, `.updateOne()` | Copilot |
| `xss-dangerously` | dangerouslySetInnerHTML with user input | AST: `dangerouslySetInnerHTML` where value traces back to props, state, or API response | Lovable, Bolt |
| `eval-usage` | eval() or Function() with dynamic input | AST: `eval()`, `new Function()`, `setTimeout(string)` | Copilot |
| `command-injection` | Shell command with unsanitised input | AST: `exec()`, `spawn()`, `execSync()` with template literal or concat arguments | Claude Code |

### 5.4 CORS & headers

| Rule ID | Title | Pattern | AI tools |
|---------|-------|---------|----------|
| `cors-wildcard` | CORS allows all origins | Regex: `Access-Control-Allow-Origin.*\*` or `cors({ origin: true })` | All tools |
| `cors-credentials-wildcard` | CORS with credentials and wildcard origin | AST: CORS config with both `credentials: true` and `origin: '*'` or `origin: true` | Copilot, Cursor |
| `missing-security-headers` | Missing security headers | Absence of `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` in middleware or response | All tools |
| `no-rate-limit` | API routes without rate limiting | AST: API route handlers without rate limiting middleware | All tools |

### 5.5 Data exposure

| Rule ID | Title | Pattern | AI tools |
|---------|-------|---------|----------|
| `full-error-client` | Full error stack trace sent to client | AST: `catch(e) { res.json({ error: e })` or `return NextResponse.json({ error: error.message, stack: error.stack })` | All tools |
| `console-log-sensitive` | console.log with sensitive data | AST: `console.log` containing variables named `password`, `token`, `secret`, `key`, `credential` | Copilot, Claude Code |
| `unfiltered-query` | Database query results returned without field filtering | AST: `.select('*')` followed by direct response without field picking | Lovable, Bolt |
| `debug-mode-prod` | Debug mode enabled in production config | Regex: `DEBUG\s*=\s*true` or `NODE_ENV.*development` in production config files | All tools |

### 5.6 Dependency & config

| Rule ID | Title | Pattern | AI tools |
|---------|-------|---------|----------|
| `outdated-critical-dep` | Known vulnerable dependency version | Check `package.json` versions against known CVE database (npm audit equivalent) | All tools |
| `no-input-validation` | API endpoint without input validation | AST: request body or query params used without zod, joi, yup, or manual validation | All tools |
| `unvalidated-redirect` | Redirect using user-supplied URL | AST: `redirect(req.query.redirect)` or `router.push(searchParams.get('next'))` without URL validation | Lovable, Bolt |
| `insecure-cookie` | Cookie set without secure flags | AST: `setCookie` or `cookies().set()` without `httpOnly`, `secure`, `sameSite` | Copilot |

---

## 6. Features

### 6.1 Core scanning (P0)

| Feature | Description | Effort |
|---------|------------|--------|
| File upload scanner | Upload a zip or folder. Extract, parse all JS/TS/Python files, run rule library against each. | 3 days |
| Code paste scanner | Paste a single file or code block. Instant scan with results. | 1 day |
| GitHub repo scanner | Connect GitHub, select repo and branch. Clone and scan. | 3 days |
| Rule engine | Pattern matching engine supporting regex, AST queries (tree-sitter), and file-level checks. | 4 days |
| Results dashboard | Per-scan results page: findings list sorted by severity, file tree with markers, code snippets with highlighted lines. | 3 days |
| Risk score and grade | Calculate overall risk score (0-100) and letter grade (A-F) based on weighted severity counts. | 1 day |
| Finding detail view | Click finding to see: full code context, rule explanation, which AI tools commonly produce this, and fix suggestion. | 2 days |

### 6.2 AI-powered analysis (P0)

| Feature | Description | Effort |
|---------|------------|--------|
| Contextual explanation | Claude API analyses each critical/high finding in context of surrounding code. Explains why it is dangerous in plain English. | 2 days |
| Fix suggestion | Claude generates a specific code fix for each finding. Shows diff-style before/after. | 2 days |
| AI tool attribution | For each finding, indicate which AI coding tools commonly produce this pattern. Helps users understand their tool's blind spots. | 1 day |

### 6.3 Reporting (P1)

| Feature | Description | Effort |
|---------|------------|--------|
| PDF security report | Professional PDF: executive summary, risk score, findings by severity, top recommendations. Shareable with clients or leadership. | 2 days |
| Scan comparison | Compare two scans of the same project. Show fixed, new, and persistent findings. Track security posture over time. | 2 days |
| Scan history | List all scans with risk scores and trend sparkline. Track improvement over time. | 1 day |

### 6.4 Integrations (P2)

| Feature | Description | Effort |
|---------|------------|--------|
| GitHub PR checks | GitHub App that auto-scans PRs and posts findings as review comments. Block merge if critical findings. | 4 days |
| CI/CD integration | CLI tool (`npx vibescan`) that runs in CI pipelines. Exit code 1 if critical findings. JSON output for pipeline processing. | 3 days |
| VS Code extension | Inline highlighting of findings while coding. Triggered on save. | 4 days |
| Slack alerts | Notify on new scan completion with summary. Alert on critical findings. | 1 day |

---

## 7. Claude Code build plan

### Phase 1: Foundation (Sessions 1-4)

#### Session 1: Project scaffold and auth

```
Create a Next.js 14 app with App Router, Tailwind CSS, and shadcn/ui.
Set up Supabase project with auth (email + GitHub SSO).
Create the database schema from Section 4 of the PRD.
Enable Row Level Security on all tables.
Seed the rules table with all rules from Section 5 of the PRD.
Create a landing page with sign-up/login flow.
After auth, redirect to /dashboard.
Use environment variables for all Supabase keys and Claude API key.
Git commit after each major step.
```

#### Session 2: Code paste scanner and rule engine

```
Build /scan/paste page:
  - Large code input textarea with syntax highlighting (use Monaco editor or CodeMirror)
  - Language selector dropdown (JavaScript, TypeScript, Python)
  - "Scan" button

Build the rule engine as a server-side function:
  - Accept: code string, language, list of enabled rules
  - For each rule where pattern_type='regex':
    - Run regex against each line, capture matches with line numbers
  - For each rule where pattern_type='ast':
    - Parse code with tree-sitter (install @vscode/tree-sitter-wasm or use acorn for JS/TS)
    - Run AST queries to detect patterns
  - Return array of findings: { rule_id, file_path, line_number, code_snippet, severity, category, title, description }

Display results immediately below the input:
  - Summary bar: X critical, Y high, Z medium
  - Findings list grouped by severity
  - Each finding shows: title, severity badge, line number, 3-line code snippet with highlighted match
  - Risk score (0-100) and letter grade

Save scan and findings to database.
```

#### Session 3: File upload scanner

```
Build /scan/upload page:
  - Drag-and-drop zone for zip files or folder upload
  - File size limit: 50MB
  - Supported: .zip, .tar.gz, or individual files

Build the server-side extraction and scanning pipeline:
  - Extract uploaded archive to temp directory
  - Walk file tree, filter to scannable extensions (.js, .jsx, .ts, .tsx, .py, .env, .json, package.json)
  - For each file: run the rule engine from Session 2
  - Aggregate all findings into a single scan record
  - Calculate scan_summary: total findings, counts by severity, top categories, risk score, grade
  - Save everything to database

Build the scan results page at /scans/[id]:
  - Left sidebar: file tree with finding count badges per file
  - Main area: findings for selected file (or all files)
  - Click a file to filter findings to that file
  - Each finding: severity badge, title, line number, code snippet, expand for description
  - Top summary bar: grade circle (A-F with color), total findings, breakdown by severity
  - Scan metadata: files scanned, lines scanned, duration
```

#### Session 4: AI-powered explanations and fix suggestions

```
Build the Claude-powered analysis layer:
  - For each critical and high severity finding, send to Claude API:
    System prompt: "You are a security expert reviewing AI-generated code. Given this code snippet and the detected vulnerability, provide:
    1. A plain-English explanation of why this is dangerous (2-3 sentences)
    2. The specific attack vector (how an attacker would exploit this)
    3. A corrected code snippet that fixes the issue
    4. Which AI coding tools commonly produce this pattern and why
    Return JSON: { explanation, attack_vector, fixed_code, ai_tool_context }"
  - Send in batches of 5 findings per API call to manage costs
  - Store results in findings.ai_explanation and findings.fix_suggestion
  - Show a loading state while AI analysis runs (can be async, results appear as ready)

Build the finding detail view:
  - Expandable panel on each finding showing:
    - AI explanation with attack vector description
    - Before/after code diff showing the fix
    - "Which AI tools produce this" section with tool logos/names
    - "Mark as false positive" button (sets false_positive=true, excludes from score)
    - "Mark as fixed" button (sets fixed=true)
  
Rebuild risk score excluding false positives.
```

### Phase 2: GitHub integration and reporting (Sessions 5-8)

#### Session 5: GitHub repo scanner

```
Build GitHub OAuth integration:
  - GitHub App registration (or OAuth App) for repo access
  - Store GitHub access token in Supabase (encrypted)
  - /settings/integrations page showing GitHub connection status

Build /scan/github page:
  - List user's GitHub repos (paginated)
  - Select repo, select branch (default: main)
  - "Scan" button

Build the server-side GitHub scanner:
  - Clone repo to temp directory (shallow clone, depth=1)
  - Run the same file-walk and rule engine from Session 3
  - Clean up temp directory after scan
  - Same results page as file upload scanner

Handle rate limits and large repos:
  - Skip node_modules, .git, dist, build directories
  - File count limit: 500 files per scan (free tier)
  - Timeout: 120 seconds per scan
```

#### Session 6: Dashboard and scan history

```
Build the main dashboard at /dashboard:
  - Summary cards: total scans, average risk score, total findings (all time), critical findings (unresolved)
  - Recent scans table: name, source, date, grade, findings count, status
  - Risk score trend chart (Recharts line chart, last 10 scans)
  - Top vulnerability categories pie chart

Build scan comparison:
  - Select two scans of the same project
  - Show: new findings (in scan B but not A), fixed findings (in A but not B), persistent findings (in both)
  - Net change: +X new, -Y fixed
  - Visual diff of risk scores

Build the scan history at /scans:
  - Full list of all scans, sortable by date, grade, findings count
  - Filter by source type, grade range
  - Sparkline showing risk score trend per project
```

#### Session 7: PDF report generation

```
Build the security report PDF generator:
  - Use React-PDF (@react-pdf/renderer) for server-side generation
  - Report structure:
    1. Cover page: project name, scan date, grade circle, risk score
    2. Executive summary: 1 paragraph overview, key stats, top 3 recommendations
    3. Findings by severity: grouped tables with file, line, title, status
    4. Detailed findings: for critical and high only — full code snippet, explanation, fix
    5. AI tool analysis: which tools produced which patterns, frequency chart
    6. Methodology: how scanning works, rule library version, confidence notes
  - "Download report" button on scan results page
  - Store generated PDF in Supabase Storage with signed URL (7 day expiry)
```

#### Session 8: CLI tool for CI/CD

```
Build the VibeScan CLI tool (npx vibescan):
  - Package as an npm package
  - Commands:
    - `vibescan scan .` — scan current directory
    - `vibescan scan ./path` — scan specific path
    - `vibescan --format json` — output findings as JSON (for CI pipeline parsing)
    - `vibescan --fail-on critical` — exit code 1 if critical findings found
    - `vibescan --fail-on high` — exit code 1 if critical or high findings found
  - Requires VIBESCAN_API_KEY environment variable
  - Uploads file list and code to API, receives results
  - Pretty-prints results in terminal with colors
  - Shows summary: grade, risk score, findings count
  
Build the API endpoint for CLI:
  - POST /api/cli/scan — accepts multipart file upload with API key auth
  - Returns scan results as JSON
  - Rate limited per API key
  
Add GitHub Actions example to docs:
  - .github/workflows/vibescan.yml template
  - Runs on PR, posts summary as comment
```

### Phase 3: GitHub PR integration (Sessions 9-10)

#### Session 9: GitHub App for PR scanning

```
Build a GitHub App:
  - Listens for pull_request events (opened, synchronize)
  - On PR event: clone the PR branch, scan changed files only
  - Post findings as PR review comments on the specific lines
  - Post a summary comment: grade, findings count, top issues
  - Set commit status: success (no critical), failure (critical found)

Configuration:
  - /settings/github page: enable/disable PR scanning per repo
  - Configure severity threshold for blocking merge
  - Configure which rules to skip (false positive management)
```

#### Session 10: Polish and onboarding

```
Build the onboarding flow:
  - New user: guided tour (3 steps: paste code → see results → understand a finding)
  - Demo scan: pre-loaded example with intentionally vulnerable AI-generated code
  - "Scan your first project" CTA on empty dashboard

Build the rules library browser at /rules:
  - List all rules with: ID, title, severity, category, affected AI tools, enabled/disabled toggle
  - Click rule for full description, example vulnerable code, example fix
  - Filter by category, severity, AI tool

Build the settings page:
  - Organisation settings: name, billing
  - Notification preferences: email on scan complete, Slack webhook
  - API key management: view, regenerate, revoke
  - GitHub integration management
```

---

## 8. Monetisation

| | Free | Pro ($29/mo) | Team ($99/mo) |
|---|---|---|---|
| Scans per month | 5 | 50 | Unlimited |
| Code paste scanner | Yes | Yes | Yes |
| File upload (max size) | 10MB | 50MB | 200MB |
| GitHub repo scanner | No | Yes | Yes |
| AI explanations | 3 per scan | All findings | All findings |
| PDF reports | No | Yes | Yes |
| CLI tool | No | Yes | Yes |
| GitHub PR scanning | No | No | Yes |
| Scan history retention | 7 days | 90 days | 1 year |
| Team members | 1 | 1 | 10 |
| Priority support | No | Email | Email + Slack |

---

## 9. Success metrics

- **Adoption:** 500 scans in first month, 100 registered users
- **Activation:** 60% of users who sign up complete at least one scan
- **Retention:** 40% of users scan again within 7 days
- **Findings accuracy:** <5% false positive rate on critical/high findings
- **Revenue:** 50 Pro subscribers within 3 months of launch
- **Community:** Open-source the rule library on GitHub, accept community rule contributions

---

## 10. Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| False positives erode trust | Conservative severity classification. "Mark as false positive" feature. Track and reduce FP rate weekly. |
| Large repos timeout | Shallow clone, file count limits, skip non-source directories. Async scanning with webhook notification for large repos. |
| AI explanation costs | Batch findings, only explain critical/high. Cache explanations for identical patterns. Limit free tier to 3 per scan. |
| Rule library becomes stale | Monthly review of new AI tool patterns. Community contribution pipeline. Track which rules fire most/least. |
| Competition from GitHub/Snyk | Differentiate on AI-tool-specific attribution and fix suggestions. Speed of scanning. Developer experience. Niche positioning ("built by someone who vibe-codes"). |
