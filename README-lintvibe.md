# Lintvibe

**Security scanner built for vibe-coded apps.**

AI coding assistants (Copilot, Cursor, Claude Code, Lovable, Bolt) produce 1.7x more security vulnerabilities than hand-written code. They repeat the same antipatterns across every project. Traditional SAST tools miss them because they were trained on human-written code. Lintvibe has 41 detection rules tuned specifically to what AI tools produce and where they fail.

---

## Features

### Scanning Modes

- **Paste Scanner**: Paste a code snippet directly in the browser. Instant results, no account required.
- **File Upload Scanner**: Upload a `.zip` of your project (up to 50MB). Supports JavaScript, TypeScript, and Python.
- **GitHub Repo Scanner**: Connect a GitHub repository, pick a branch, and scan it. Lintvibe clones and analyzes the full repo.

### Detection Engine

41 rules across six categories, using three analysis methods: regex, AST (abstract syntax tree), and file-level checks.

**Secrets and Credentials**
- Hardcoded API keys and passwords
- Supabase service role keys in client code
- `.env` files committed to the repo
- Exposed environment variables

**Authentication**
- API routes with no auth check
- Supabase queries missing Row Level Security
- Unverified JWT tokens
- Default admin credentials
- Missing CSRF protection

**Injection**
- SQL string interpolation
- NoSQL injection
- XSS via `dangerouslySetInnerHTML`
- `eval()` usage
- Command injection

**CORS and Headers**
- Wildcard CORS origins combined with credentials
- Missing security headers
- No rate limiting on public endpoints

**Data Exposure**
- Full error stack traces sent to clients
- `console.log` statements containing secrets
- Unfiltered database results returned to users
- Debug mode enabled in production builds

**Dependencies and Configuration**
- Known vulnerable dependency versions
- Missing input validation
- Unvalidated redirects
- Insecure cookie configuration

### AI-Powered Analysis

Every critical or high-severity finding gets:
- An explanation of why it is dangerous and what the attack vector is
- A before/after code diff with the corrected version
- Attribution to the AI tool that commonly produces the pattern (e.g., "Copilot commonly produces this when generating API routes")

Powered by the Claude API.

### Reporting

- **Risk Score**: 0 to 100 score and an A to F letter grade per scan
- **PDF Reports**: Exportable reports with executive summary, severity breakdown, and remediation recommendations
- **Scan Comparison**: Compare two scans of the same project to see which findings were fixed, which are new, and which persist
- **Scan History**: All scans stored with trend sparklines to track improvement over time

### CI/CD Integration

**GitHub PR Webhook**: Auto-scans every pull request, posts findings as inline review comments, and can block merges on critical findings.

**CLI Tool**:
```bash
npx lintvibe scan .
npx lintvibe scan . --format json
npx lintvibe scan . --fail-on critical
```

The CLI returns a non-zero exit code on failures, making it drop-in ready for GitHub Actions, GitLab CI, or any other pipeline.

### Rules Browser

An interactive library of all 41 rules. Filter by severity (critical, high, medium, low), category (auth, injection, secrets, etc.), or AI tool. Each rule shows the detection pattern, a vulnerable code example, and the fix.

### Billing and Access

- **Free**: 10 scans/month, 500 files/scan, 41 rules, PDF export, 3 AI explanations/month
- **Pro** (€29/month): Unlimited scans, unlimited AI explanations, PR webhook integration, AI Deep Scan
- **Team** (€99/month): Everything in Pro plus 5 team members, shared scan history, SSO (coming), custom rules (coming)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| Styling | Tailwind CSS 4, shadcn/ui |
| Auth | NextAuth v5 with Prisma adapter |
| Database | PostgreSQL via Prisma v6 |
| AI | Claude API (Anthropic SDK v0.82) |
| PDF | @react-pdf/renderer v4.3 |
| Charts | Recharts v3.8 |
| Code editor | Monaco Editor |
| Billing | Stripe v22 |
| Email | Resend v6.10 |
| AST parsing | Tree-sitter |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Anthropic API key (for AI explanations)
- GitHub OAuth app (for GitHub login and repo scanning)

### Environment Variables

Create a `.env` file at the project root:

```env
DATABASE_URL=postgresql://user:password@host:5432/lintvibe

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

ANTHROPIC_API_KEY=your-anthropic-api-key

# Optional: Stripe billing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Optional: email via Resend
RESEND_API_KEY=re_...
APP_URL=http://localhost:3000
```

### Install and Run

```bash
npm install

# Run database migrations
npx prisma migrate dev

# Seed the 41 detection rules
npm run seed

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm start
```

---

## CLI Tool

The CLI lives in `cli/` and publishes as `lintvibe` on npm.

```bash
# Build the CLI
cd cli
npm run build

# Scan a directory
npx lintvibe scan /path/to/project

# Scan and output JSON (for pipeline parsing)
npx lintvibe scan . --format json

# Exit with code 1 if any critical findings exist
npx lintvibe scan . --fail-on critical

# Exit with code 1 if any high or critical findings exist
npx lintvibe scan . --fail-on high
```

### GitHub Actions Example

```yaml
- name: Lintvibe security check
  run: npx lintvibe scan . --fail-on critical
  env:
    LINTVIBE_API_KEY: ${{ secrets.LINTVIBE_API_KEY }}
```

---

## Project Structure

```
lintvibe/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── page.tsx          # Landing page
│   │   ├── dashboard/        # Main dashboard
│   │   ├── scan/             # Paste, upload, and GitHub scan pages
│   │   ├── scans/            # Results and scan history
│   │   ├── rules/            # Rules browser
│   │   ├── billing/          # Subscription management
│   │   ├── admin/            # Admin panel
│   │   └── api/              # API routes
│   ├── components/           # Shared React components
│   └── lib/
│       ├── engine/           # Scanning engine
│       │   ├── ast-runner.ts # Tree-sitter AST analysis
│       │   ├── regex-runner.ts
│       │   ├── dep-scanner.ts
│       │   ├── project-graph.ts  # Cross-file data flow analysis
│       │   ├── scorer.ts     # Risk score and grade calculation
│       │   └── scan-files.ts
│       ├── ai-explain.ts     # Claude API calls for explanations
│       ├── ai-deepscan.ts    # Layer 2 deep analysis
│       ├── auth.ts
│       ├── stripe.ts
│       └── github.ts
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts               # 41 detection rules
├── cli/                      # CLI tool source
└── public/                   # Static assets
```

---

## Database Schema

Core tables:

- **User**: Email, role (ADMIN/MEMBER/VIEWER), organization membership, API keys
- **Organization**: Name, subscription tier, Stripe IDs
- **Scan**: Source type (UPLOAD/GITHUB/PASTE), status (PENDING/SCANNING/COMPLETE/FAILED), file counts, timestamps
- **Finding**: Rule ID, file, line number, code snippet, severity, AI explanation, fix suggestion, false positive flag
- **ScanSummary**: Denormalized totals: severity counts, risk score, grade
- **Rule**: All 41 detection rules with patterns, categories, severity, and AI tool attribution
- **ConnectedRepo**: GitHub repos with webhook secrets and fail-on thresholds
- **UserException**: Admin-granted feature overrides (unlimited scans, unlimited AI, deep scan)

---

## Roadmap

- [ ] Custom rules per organization
- [ ] VS Code extension
- [ ] Slack alerts
- [ ] SSO
- [ ] Public community rule library
