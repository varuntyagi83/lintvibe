"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function RescanButton({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRescan() {
    setLoading(true);
    try {
      const res = await fetch(`/api/scan/${scanId}/rescan`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        console.error("[rescan]", data.error);
        return;
      }
      router.push(`/scans/${data.scanId}`);
    } catch (err) {
      console.error("[rescan]", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRescan}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-sm font-medium border border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Scanning…" : "Re-scan"}
    </button>
  );
}
