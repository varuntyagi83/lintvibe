import Link from "next/link";
import { Shield, Zap, Code2, GitBranch, Lock, AlertTriangle, Check } from "lucide-react";

const PRICING_TIERS = [
  {
    name: "Free",
    price: "€0",
    period: "/mo",
    description: "No credit card required",
    cta: "Get started free",
    ctaHref: "/login",
    ctaVariant: "outline" as const,
    popular: false,
    features: [
      "10 scans/month",
      "Up to 500 files per scan",
      "41 detection rules",
      "PDF export",
      "3 AI explanations/month",
    ],
  },
  {
    name: "Pro",
    price: "€29",
    period: "/mo",
    description: "Most popular for solo devs",
    cta: "Start free trial",
    ctaHref: "/login",
    ctaVariant: "primary" as const,
    popular: true,
    features: [
      "Unlimited scans",
      "Up to 500 files per scan",
      "41 detection rules + AI Deep Scan",
      "PDF export",
      "Unlimited AI explanations",
      "PR webhook integration",
      "Priority support",
    ],
  },
  {
    name: "Team",
    price: "€99",
    period: "/mo",
    description: "For growing engineering teams",
    cta: "Contact us",
    ctaHref: "mailto:hello@vibescan.app",
    ctaVariant: "outline" as const,
    popular: false,
    features: [
      "Everything in Pro",
      "5 team members",
      "Shared scan history",
      "Custom rules (coming soon)",
      "SSO (coming soon)",
      "Dedicated support",
    ],
  },
];

const VULNERABILITY_CATEGORIES = [
  { icon: Lock, label: "Hardcoded secrets", tools: "All AI tools" },
  { icon: AlertTriangle, label: "Missing auth checks", tools: "Lovable, Bolt" },
  { icon: Code2, label: "SQL injection", tools: "Copilot, Cursor" },
  { icon: Shield, label: "Overpermissive CORS", tools: "All AI tools" },
  { icon: Zap, label: "Exposed env vars", tools: "All AI tools" },
  { icon: GitBranch, label: "No input validation", tools: "All AI tools" },
];

const AI_TOOLS = ["Copilot", "Cursor", "Claude Code", "Lovable", "Bolt"];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-red-500" />
          <span className="font-bold text-lg tracking-tight">VibeScan</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Sign in
          </Link>
          <Link href="/login" className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium transition-colors hover:bg-primary/80">
            Get started free
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950 border border-red-800 text-red-400 text-xs font-medium mb-8">
          <AlertTriangle className="h-3 w-3" />
          AI-generated code has 1.7× more security vulnerabilities
        </div>

        <h1 className="text-5xl md:text-6xl font-bold tracking-tight max-w-3xl mb-6 leading-tight">
          Security scanner built for{" "}
          <span className="text-red-500">vibe-coded</span> apps
        </h1>

        <p className="text-zinc-400 text-lg max-w-xl mb-10 leading-relaxed">
          Copilot, Cursor, Claude Code, Lovable, and Bolt all introduce the same
          repeatable vulnerability patterns. VibeScan catches them before they
          reach production.
        </p>

        <div className="flex items-center gap-3">
          <Link href="/login" className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-primary/80">
            Scan your first project →
          </Link>
          <Link href="/demo" className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-transparent text-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-800">
            See a demo scan
          </Link>
        </div>

        {/* AI tools strip */}
        <div className="flex items-center gap-3 mt-12 text-sm text-zinc-500">
          <span>Detects patterns from:</span>
          {AI_TOOLS.map((tool) => (
            <span
              key={tool}
              className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs"
            >
              {tool}
            </span>
          ))}
        </div>
      </section>

      {/* Vulnerability categories */}
      <section className="border-t border-zinc-800 px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl font-bold mb-2">
            41 detection rules, tuned for AI-generated code
          </h2>
          <p className="text-center text-zinc-400 text-sm mb-10">
            Real patterns we&apos;ve seen in production apps built with AI tools
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {VULNERABILITY_CATEGORIES.map(({ icon: Icon, label, tools }) => (
              <div
                key={label}
                className="flex items-start gap-3 p-4 rounded-lg bg-zinc-900 border border-zinc-800"
              >
                <Icon className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{tools}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-zinc-800 px-6 py-16 bg-zinc-900/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-10">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Upload or connect",
                desc: "Paste code, upload a zip, or connect your GitHub repo",
              },
              {
                step: "2",
                title: "Deep scan",
                desc: "AST parsing + regex across 41 AI-specific vulnerability rules",
              },
              {
                step: "3",
                title: "Get your grade",
                desc: "Risk score, severity breakdown, and AI-powered fix suggestions",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-950 border border-red-800 text-red-400 font-bold flex items-center justify-center">
                  {step}
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-zinc-400 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-border px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-2xl font-bold mb-2 text-foreground">
            Simple, transparent pricing
          </h2>
          <p className="text-center text-muted-foreground text-sm mb-2">
            Start free. Scale when you need it.
          </p>
          <p className="text-center text-muted-foreground text-xs mb-10">
            Save 20% with annual billing
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.name}
                className={[
                  "relative flex flex-col rounded-xl border bg-card p-6 transition-shadow",
                  tier.popular
                    ? "border-red-500 shadow-[0_0_0_1px_theme(colors.red.500),0_0_20px_theme(colors.red.950)]"
                    : "border-border",
                ].join(" ")}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-3 py-0.5 rounded-full bg-red-500 text-white text-xs font-semibold tracking-wide">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-sm font-semibold text-foreground mb-1">{tier.name}</p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-4xl font-bold text-foreground">{tier.price}</span>
                    <span className="text-muted-foreground text-sm mb-1">{tier.period}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">{tier.description}</p>
                </div>

                <ul className="flex flex-col gap-2 mb-6 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.ctaHref}
                  className={[
                    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    tier.ctaVariant === "primary"
                      ? "bg-primary text-primary-foreground hover:bg-primary/80"
                      : "border border-border bg-transparent text-foreground hover:bg-accent",
                  ].join(" ")}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-6 text-center text-zinc-600 text-sm">
        © {new Date().getFullYear()} VibeScan · Built by Varun Tyagi
      </footer>
    </div>
  );
}
