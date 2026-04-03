"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, GitBranch, Lock, Globe, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Repo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  updated_at: string;
  language: string | null;
}

interface Branch {
  name: string;
}

export default function GitHubScanClient({ hasRepoScope }: { hasRepoScope: boolean }) {
  const router = useRouter();

  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");

  const [scanning, startScan] = useTransition();
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRepos() {
      setLoadingRepos(true);
      setRepoError(null);
      try {
        const res = await fetch("/api/scan/github/repos");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load repos");
        setRepos(data.repos);
      } catch (err) {
        setRepoError(err instanceof Error ? err.message : "Failed to load repos");
      } finally {
        setLoadingRepos(false);
      }
    }
    loadRepos();
  }, []);

  async function selectRepo(repo: Repo) {
    setSelectedRepo(repo);
    setSelectedBranch(repo.default_branch);
    setBranches([]);
    setLoadingBranches(true);
    try {
      const [owner, name] = repo.full_name.split("/");
      const res = await fetch(`/api/scan/github/branches?owner=${owner}&repo=${name}`);
      const data = await res.json();
      if (res.ok) setBranches(data.branches);
    } catch {
      // Ignore — default_branch is still set
    } finally {
      setLoadingBranches(false);
    }
  }

  function handleScan() {
    if (!selectedRepo || !selectedBranch) return;
    setScanError(null);

    const [owner, repo] = selectedRepo.full_name.split("/");

    startScan(async () => {
      const res = await fetch("/api/scan/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, branch: selectedBranch }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error ?? "Scan failed");
        return;
      }
      router.push(`/scans/${data.scanId}`);
    });
  }

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Scope warning */}
      {!hasRepoScope && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-800 bg-yellow-950/20 text-sm">
          <Lock className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-300 font-medium">Private repos not visible</p>
            <p className="text-yellow-600 text-xs mt-0.5">
              Your GitHub connection doesn&apos;t include private repo access.{" "}
              <a
                href="/api/auth/signin?provider=github"
                className="underline hover:text-yellow-400"
              >
                Reconnect GitHub
              </a>{" "}
              to scan private repositories.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: repo list */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            Select repository
          </h2>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter repositories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {loadingRepos ? (
            <div className="flex items-center justify-center py-12 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading repositories…
            </div>
          ) : repoError ? (
            <div className="py-6 text-center text-red-400 text-sm">{repoError}</div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center text-zinc-500 text-sm">
              {search ? "No repos match your search" : "No repositories found"}
            </div>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
              {filtered.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => selectRepo(repo)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    selectedRepo?.id === repo.id
                      ? "border-zinc-500 bg-zinc-800"
                      : "border-transparent hover:border-zinc-700 hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {repo.private ? (
                      <Lock className="h-3 w-3 text-zinc-500 shrink-0" />
                    ) : (
                      <Globe className="h-3 w-3 text-zinc-500 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-zinc-200 truncate">
                      {repo.full_name}
                    </span>
                    {repo.language && (
                      <span className="ml-auto text-xs text-zinc-500 shrink-0">
                        {repo.language}
                      </span>
                    )}
                  </div>
                  {repo.description && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate pl-5">
                      {repo.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: branch + scan */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            Scan options
          </h2>

          {!selectedRepo ? (
            <div className="flex items-center justify-center h-40 border border-dashed border-zinc-800 rounded-xl text-zinc-600 text-sm">
              Select a repository to continue
            </div>
          ) : (
            <div className="space-y-4 border border-zinc-800 rounded-xl p-4">
              <div>
                <p className="text-sm font-medium mb-0.5">{selectedRepo.full_name}</p>
                {selectedRepo.description && (
                  <p className="text-xs text-zinc-500">{selectedRepo.description}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-medium">Branch</label>
                <div className="relative">
                  <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  {loadingBranches ? (
                    <div className="flex items-center gap-2 pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading branches…
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="w-full appearance-none bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-8 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                      >
                        {branches.length > 0
                          ? branches.map((b) => (
                              <option key={b.name} value={b.name}>
                                {b.name}
                              </option>
                            ))
                          : <option value={selectedRepo.default_branch}>{selectedRepo.default_branch}</option>}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-1 space-y-2">
                <div className="text-xs text-zinc-600 space-y-0.5">
                  <p>Scans JS, TS, and Python files · Max 500 files · 26 rules</p>
                  <p>node_modules, .git, dist, build directories are skipped</p>
                </div>

                {scanError && (
                  <p className="text-red-400 text-sm">{scanError}</p>
                )}

                <Button
                  onClick={handleScan}
                  disabled={scanning || !selectedBranch}
                  className="w-full bg-red-700 hover:bg-red-600"
                >
                  {scanning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Scanning…
                    </>
                  ) : (
                    <>
                      <GitBranch className="h-3.5 w-3.5 mr-1.5" />
                      Scan {selectedRepo.name}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
