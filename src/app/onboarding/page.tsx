import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, FileCode, Upload, BookOpen, GitBranch } from "lucide-react";
import GitHubIcon from "@/components/icons/GitHubIcon";
import AppHeader from "@/components/AppHeader";

const AI_TOOLS = ["Copilot", "Cursor", "Lovable", "Bolt", "Claude Code"];

const STATS = [
  { value: "41", label: "detection rules" },
  { value: "6", label: "vulnerability categories" },
  { value: "5", label: "AI tools covered" },
];

const CATEGORIES = [
  { name: "Secrets & Credentials", icon: "🔑", desc: "Hardcoded API keys, passwords, .env files committed to repos" },
  { name: "Authentication", icon: "🔒", desc: "Missing auth checks, JWT without verification, default credentials" },
  { name: "Injection", icon: "💉", desc: "SQL injection, XSS via dangerouslySetInnerHTML, eval(), command injection" },
  { name: "CORS & Headers", icon: "🌐", desc: "Wildcard origins, missing security headers, no rate limiting" },
  { name: "Data Exposure", icon: "📤", desc: "Error stacks sent to client, sensitive console.log, SELECT *" },
  { name: "Configuration", icon: "⚙️", desc: "No input validation, open redirects, insecure cookie flags" },
];

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // If they already have scans, they don't need onboarding
  const scanCount = await prisma.scan.count({ where: { createdById: session.user.id! } });
  if (scanCount > 0) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader email={session.user.email} />

      <main className="flex-1 px-6 py-16 max-w-4xl mx-auto w-full">

        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-red-950 border border-red-800 text-red-400 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <Shield className="h-3 w-3" />
            AI-generated code security scanner
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Your AI-generated code<br />
            <span className="text-red-400">probably has security holes</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            VibeScan finds the exact vulnerabilities that{" "}
            <span className="text-zinc-200">{AI_TOOLS.join(", ")}</span>{" "}
            introduce — before attackers do.
          </p>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 mt-8">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scan options */}
        <div className="mb-14">
          <p className="text-center text-sm text-zinc-400 mb-6 uppercase tracking-wider font-medium">
            Run your first scan
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/scan/paste"
              className="group flex flex-col gap-3 p-6 border border-zinc-800 rounded-xl hover:border-zinc-600 hover:bg-zinc-900/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-zinc-800 rounded-lg group-hover:bg-zinc-700 transition-colors">
                  <FileCode className="h-5 w-5 text-zinc-300" />
                </div>
                <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">→</span>
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">Paste code</p>
                <p className="text-xs text-zinc-500">Scan a single file or snippet instantly — no setup needed</p>
              </div>
              <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded self-start">Fastest</span>
            </Link>

            <Link
              href="/scan/upload"
              className="group flex flex-col gap-3 p-6 border border-zinc-800 rounded-xl hover:border-zinc-600 hover:bg-zinc-900/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-zinc-800 rounded-lg group-hover:bg-zinc-700 transition-colors">
                  <Upload className="h-5 w-5 text-zinc-300" />
                </div>
                <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">→</span>
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">Upload ZIP</p>
                <p className="text-xs text-zinc-500">Export your project as a ZIP and scan all files at once</p>
              </div>
              <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded self-start">Multi-file</span>
            </Link>

            <Link
              href="/scan/github"
              className="group flex flex-col gap-3 p-6 border border-zinc-800 rounded-xl hover:border-zinc-600 hover:bg-zinc-900/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-zinc-800 rounded-lg group-hover:bg-zinc-700 transition-colors">
                  <GitHubIcon className="h-5 w-5 text-zinc-300" />
                </div>
                <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">→</span>
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">GitHub repo</p>
                <p className="text-xs text-zinc-500">Connect your GitHub account and scan any branch directly</p>
              </div>
              <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded self-start">Recommended</span>
            </Link>
          </div>
        </div>

        {/* What we detect */}
        <div className="mb-14">
          <p className="text-center text-sm text-zinc-400 mb-6 uppercase tracking-wider font-medium">
            What VibeScan detects
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CATEGORIES.map(({ name, icon, desc }) => (
              <div key={name} className="flex items-start gap-3 p-4 border border-zinc-800 rounded-xl">
                <span className="text-lg shrink-0">{icon}</span>
                <div>
                  <p className="text-sm font-semibold mb-0.5">{name}</p>
                  <p className="text-xs text-zinc-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-6 text-sm">
          <Link
            href="/rules"
            className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Browse all 41 detection rules
          </Link>
          <Link
            href="/integrations"
            className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <GitBranch className="h-3.5 w-3.5" />
            Set up PR integration
          </Link>
        </div>
      </main>
    </div>
  );
}
