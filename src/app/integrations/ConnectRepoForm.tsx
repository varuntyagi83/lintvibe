"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";

interface ConnectedRepo {
  id: string;
  owner: string;
  repo: string;
  webhookSecret: string;
  failOn: string;
  createdAt: string;
}

interface Props {
  initialRepos: ConnectedRepo[];
  webhookBaseUrl: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="text-zinc-400 hover:text-zinc-200 transition-colors" title="Copy">
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function RepoCard({ repo, webhookUrl, onDisconnect }: {
  repo: ConnectedRepo;
  webhookUrl: string;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    if (!confirm(`Disconnect ${repo.owner}/${repo.repo}? The webhook will stop working.`)) return;
    setDisconnecting(true);
    await fetch("/api/integrations/repos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: repo.owner, repo: repo.repo }),
    });
    onDisconnect();
  }

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="font-medium text-sm">
            {repo.owner}/{repo.repo}
          </span>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
            fail on {repo.failOn}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-zinc-400 hover:text-zinc-200 text-xs flex items-center gap-1 transition-colors"
          >
            Setup {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-zinc-600 hover:text-red-400 text-xs transition-colors disabled:opacity-50"
          >
            {disconnecting ? "Removing…" : "Disconnect"}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-zinc-800 bg-zinc-900/50 px-4 py-4 space-y-4">
          <p className="text-xs text-zinc-400">
            Add this webhook in your GitHub repo under{" "}
            <strong className="text-zinc-300">Settings → Webhooks → Add webhook</strong>
          </p>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">Payload URL</p>
              <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                <code className="text-xs text-zinc-200 flex-1 break-all">{webhookUrl}</code>
                <CopyButton text={webhookUrl} />
              </div>
            </div>

            <div>
              <p className="text-xs text-zinc-500 mb-1.5">Secret</p>
              <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                <code className="text-xs text-zinc-200 flex-1 font-mono break-all">{repo.webhookSecret}</code>
                <CopyButton text={repo.webhookSecret} />
              </div>
            </div>

            <p className="text-xs text-zinc-500">
              Set content type to <code className="text-zinc-300">application/json</code> and select{" "}
              <strong className="text-zinc-300">Pull requests</strong> as the event trigger.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionsYaml({ failOn }: { failOn: string }) {
  const yaml = `name: VibeScan Security Check
on:
  pull_request:
    branches: [main, master]

jobs:
  vibescan:
    name: Security scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Scan for vulnerabilities
        run: npx vibescan@latest . --fail-on ${failOn} --no-color`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-zinc-500">
          Or use GitHub Actions — add this as <code className="text-zinc-300">.github/workflows/vibescan.yml</code>
        </p>
        <CopyButton text={yaml} />
      </div>
      <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto leading-relaxed">
        {yaml}
      </pre>
    </div>
  );
}

export default function ConnectRepoForm({ initialRepos, webhookBaseUrl }: Props) {
  const router = useRouter();
  const [repos, setRepos] = useState<ConnectedRepo[]>(initialRepos);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [failOn, setFailOn] = useState("HIGH");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(initialRepos.length === 0);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/integrations/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: owner.trim(), repo: repo.trim(), failOn }),
    });

    const data = await res.json() as ConnectedRepo & { error?: string };
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to connect repository");
      return;
    }

    setRepos((prev) => [data, ...prev.filter((r) => !(r.owner === data.owner && r.repo === data.repo))]);
    setOwner("");
    setRepo("");
    setShowForm(false);
  }

  function refresh() {
    router.refresh();
    // Optimistically reload from server
    fetch("/api/integrations/repos")
      .then((r) => r.json())
      .then((data: ConnectedRepo[]) => setRepos(data))
      .catch(() => {});
  }

  return (
    <div className="space-y-6">
      {/* Connected repos */}
      {repos.length > 0 && (
        <div className="space-y-3">
          {repos.map((r) => (
            <RepoCard
              key={r.id}
              repo={r}
              webhookUrl={`${webhookBaseUrl}/api/webhooks/github`}
              onDisconnect={refresh}
            />
          ))}
        </div>
      )}

      {/* Connect form */}
      {showForm ? (
        <form onSubmit={handleConnect} className="border border-zinc-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold">Connect a repository</h3>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-zinc-400 mb-1.5">Owner (user or org)</label>
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="varuntyagi83"
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-400 mb-1.5">Repository name</label>
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="my-app"
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Block merge on</label>
            <select
              value={failOn}
              onChange={(e) => setFailOn(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
            >
              <option value="CRITICAL">CRITICAL only</option>
              <option value="HIGH">HIGH and above (recommended)</option>
              <option value="MEDIUM">MEDIUM and above</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? "Connecting…" : "Connect repository"}
            </button>
            {repos.length > 0 && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-800 transition-colors"
        >
          + Connect another repository
        </button>
      )}

      {/* GitHub Actions fallback */}
      <div className="border-t border-zinc-800 pt-6">
        <h3 className="text-sm font-semibold mb-1">Alternative: GitHub Actions</h3>
        <p className="text-xs text-zinc-500 mb-4">
          No webhook setup needed — the CLI runs directly in your CI pipeline.
        </p>
        <ActionsYaml failOn={failOn} />
      </div>
    </div>
  );
}
