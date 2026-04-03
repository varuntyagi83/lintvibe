"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, X } from "lucide-react";

const ALL_FEATURES = [
  { id: "unlimited_ai", label: "Unlimited AI" },
  { id: "unlimited_scans", label: "Unlimited scans" },
  { id: "deep_scan", label: "Deep scan" },
] as const;

export default function ExceptionManager({
  userId,
  currentExceptions,
}: {
  userId: string;
  currentExceptions: string[];
}) {
  const [exceptions, setExceptions] = useState<string[]>(currentExceptions);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function grant(feature: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}/exception`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      });
      if (res.ok) setExceptions((prev) => [...prev.filter((f) => f !== feature), feature]);
    });
  }

  function revoke(feature: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}/exception`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      });
      if (res.ok) setExceptions((prev) => prev.filter((f) => f !== feature));
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors flex items-center gap-1"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        Exceptions
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-52 bg-card border border-border rounded-xl shadow-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Grant / revoke</p>
          {ALL_FEATURES.map(({ id, label }) => {
            const active = exceptions.includes(id);
            return (
              <div key={id} className="flex items-center justify-between gap-2">
                <span className="text-xs text-foreground">{label}</span>
                <button
                  onClick={() => active ? revoke(id) : grant(id)}
                  disabled={pending}
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors disabled:opacity-40 ${
                    active
                      ? "bg-indigo-950 border-indigo-700 text-indigo-400 hover:bg-red-950 hover:border-red-700 hover:text-red-400"
                      : "bg-muted border-border text-muted-foreground hover:bg-indigo-950 hover:border-indigo-700 hover:text-indigo-400"
                  }`}
                >
                  {active ? <><X className="h-2.5 w-2.5" />Revoke</> : <><Plus className="h-2.5 w-2.5" />Grant</>}
                </button>
              </div>
            );
          })}
          <button
            onClick={() => setOpen(false)}
            className="w-full text-xs text-muted-foreground hover:text-foreground pt-1 text-center"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
