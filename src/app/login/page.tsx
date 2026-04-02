"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Shield, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState<"github" | "email" | null>(null);

  async function handleGitHub() {
    setLoading("github");
    await signIn("github", { callbackUrl: "/dashboard" });
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading("email");
    await signIn("nodemailer", { email, redirect: false, callbackUrl: "/dashboard" });
    setSent(true);
    setLoading(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <Shield className="h-7 w-7 text-red-500" />
          <span className="font-bold text-xl">VibeScan</span>
        </Link>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8">
          <h1 className="text-xl font-semibold mb-1">Sign in</h1>
          <p className="text-zinc-400 text-sm mb-6">
            Scan your first project in seconds
          </p>

          {/* GitHub */}
          <Button
            className="w-full mb-4"
            variant="outline"
            onClick={handleGitHub}
            disabled={loading !== null}
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            {loading === "github" ? "Redirecting…" : "Continue with GitHub"}
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-zinc-900 text-zinc-500">or</span>
            </div>
          </div>

          {/* Magic link */}
          {sent ? (
            <div className="text-center py-4">
              <Mail className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="font-medium text-sm">Check your email</p>
              <p className="text-zinc-400 text-xs mt-1">
                We sent a magic link to <strong>{email}</strong>
              </p>
            </div>
          ) : (
            <form onSubmit={handleEmail} className="space-y-3">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <Button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-500"
                disabled={loading !== null}
              >
                <Mail className="h-4 w-4 mr-2" />
                {loading === "email" ? "Sending…" : "Continue with email"}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-zinc-600 text-xs mt-6">
          By signing in you agree to our{" "}
          <Link href="/terms" className="underline hover:text-zinc-400">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-zinc-400">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
