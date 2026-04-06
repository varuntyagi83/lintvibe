import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";
import PasteScanner from "@/components/scan/PasteScanner";

export default async function PasteScanPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-500" />
          <span className="font-bold tracking-tight">VibeScan</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <span>{session.user.email}</span>
          <Link href="/api/auth/signout" className="hover:text-zinc-200 transition-colors">
            Sign out
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Paste scanner</h1>
          <p className="text-zinc-400 text-sm">
            Paste any JS, TS, or Python code — we&apos;ll scan it against 41 AI-specific vulnerability rules instantly.
          </p>
        </div>

        <PasteScanner />
      </main>
    </div>
  );
}
