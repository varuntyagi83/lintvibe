// vibescan-disable-file — vulnerability database constants, not application code

import type { FileEntry } from "./scan-files";
import type { Finding } from "./types";

// ─── Semver helpers ───────────────────────────────────────────────────────────

/**
 * Parse the minimum installed version from a package.json version specifier.
 * e.g.  "^4.17.20" → "4.17.20"
 *       "~9.0.0"   → "9.0.0"
 *       ">=1.6.0"  → "1.6.0"
 *       "1.2.3"    → "1.2.3"
 */
function parseMinVersion(spec: string): string {
  return spec
    .replace(/^[\^~>=<v\s]+/, "")   // strip leading operators
    .replace(/\s+.*$/, "")           // strip trailing range (e.g. " <2.0.0")
    .replace(/-[a-zA-Z].*$/, "")     // strip prerelease suffix
    .trim();
}

/** Returns true if semver a is strictly less than b (major.minor.patch). */
function semverLt(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return true;
    if (na > nb) return false;
  }
  return false;
}

/** Returns true if the spec's minimum installed version is older than fixVersion. */
function isPotentiallyVulnerable(spec: string, fixVersion: string): boolean {
  if (!spec || spec === "*" || spec === "latest") return false;
  const min = parseMinVersion(spec);
  if (!min || !/^\d/.test(min)) return false;
  return semverLt(min, fixVersion);
}

// ─── CVE database ─────────────────────────────────────────────────────────────

interface VulnEntry {
  id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  fixVersion: string;
  cveIds: string[];
}

const VULN_DB: Record<string, VulnEntry[]> = {
  lodash: [
    {
      id: "dep-lodash-proto-pollution",
      title: "Prototype Pollution via lodash merge/set/zip/setWith",
      severity: "HIGH",
      description:
        "lodash < 4.17.21 is vulnerable to prototype pollution. An attacker can supply crafted input to `_.merge`, `_.set`, `_.zipObjectDeep`, or `_.setWith` and overwrite `Object.prototype` properties, potentially achieving RCE or privilege escalation.",
      fixVersion: "4.17.21",
      cveIds: ["CVE-2021-23337", "CVE-2020-8203"],
    },
  ],
  jsonwebtoken: [
    {
      id: "dep-jwt-algorithm-confusion",
      title: "JWT Algorithm Confusion / Secret Exposure",
      severity: "CRITICAL",
      description:
        "jsonwebtoken < 9.0.0 is vulnerable to algorithm confusion attacks. An attacker who can forge or modify tokens can bypass signature verification by switching to 'none' algorithm or exploiting weak key handling, resulting in full authentication bypass.",
      fixVersion: "9.0.0",
      cveIds: ["CVE-2022-23529", "CVE-2022-23539", "CVE-2022-23540"],
    },
  ],
  axios: [
    {
      id: "dep-axios-csrf",
      title: "CSRF Header Forwarding to Third-Party Origins",
      severity: "HIGH",
      description:
        "axios < 1.6.2 forwards cookies and authorization headers to third-party origins when following redirects. An attacker who controls a redirect target can steal session tokens or CSRF credentials.",
      fixVersion: "1.6.2",
      cveIds: ["CVE-2023-45857"],
    },
  ],
  qs: [
    {
      id: "dep-qs-proto-pollution",
      title: "Prototype Pollution via qs.parse()",
      severity: "HIGH",
      description:
        "qs < 6.10.3 (and 6.9.x < 6.9.7) is vulnerable to prototype pollution via the `allowPrototypes` option or crafted query strings, potentially allowing attackers to modify `Object.prototype` and execute arbitrary code.",
      fixVersion: "6.10.3",
      cveIds: ["CVE-2022-24999"],
    },
  ],
  express: [
    {
      id: "dep-express-open-redirect",
      title: "Open Redirect via Express Response Location Header",
      severity: "HIGH",
      description:
        "express < 4.19.2 has an open redirect vulnerability in `res.redirect()`. A malicious path can bypass the intended redirect target, enabling phishing attacks or session hijacking.",
      fixVersion: "4.19.2",
      cveIds: ["CVE-2024-29041"],
    },
  ],
  semver: [
    {
      id: "dep-semver-redos",
      title: "Regular Expression Denial of Service in semver",
      severity: "MEDIUM",
      description:
        "semver < 7.5.2 is vulnerable to ReDoS. A crafted version string can cause catastrophic backtracking in the version-parsing regex, blocking the Node.js event loop and causing a Denial of Service.",
      fixVersion: "7.5.2",
      cveIds: ["CVE-2022-25883"],
    },
  ],
  ws: [
    {
      id: "dep-ws-dos",
      title: "Denial of Service via crafted WebSocket headers",
      severity: "HIGH",
      description:
        "ws < 8.17.1 (8.x) or < 7.5.10 (7.x) is vulnerable to a DoS attack. A remote attacker can send a specially crafted HTTP headers request that causes the server to abort with an out-of-memory error.",
      fixVersion: "8.17.1",
      cveIds: ["CVE-2024-37890"],
    },
  ],
  "path-to-regexp": [
    {
      id: "dep-path-to-regexp-redos",
      title: "ReDoS via Backtracking in path-to-regexp",
      severity: "HIGH",
      description:
        "path-to-regexp < 0.1.10 is vulnerable to ReDoS. A specially crafted route pattern can cause catastrophic backtracking, blocking the event loop indefinitely — a critical concern for any Next.js or Express app using dynamic routing.",
      fixVersion: "0.1.10",
      cveIds: ["CVE-2024-45296"],
    },
  ],
  "node-fetch": [
    {
      id: "dep-node-fetch-header-inject",
      title: "Fetch Header Injection in node-fetch",
      severity: "HIGH",
      description:
        "node-fetch < 2.6.7 does not validate the `Content-Length` header, allowing header injection attacks. An attacker controlling a redirect response can inject arbitrary HTTP headers into subsequent requests.",
      fixVersion: "2.6.7",
      cveIds: ["CVE-2022-0235"],
    },
  ],
  tar: [
    {
      id: "dep-tar-path-traversal",
      title: "Arbitrary File Write via Path Traversal in tar",
      severity: "HIGH",
      description:
        "tar < 6.2.1 is vulnerable to path traversal. Extracting a crafted archive can write files outside the intended extraction directory, potentially overwriting system or application files and achieving code execution.",
      fixVersion: "6.2.1",
      cveIds: ["CVE-2024-28863"],
    },
  ],
  undici: [
    {
      id: "dep-undici-smuggling",
      title: "HTTP Request Smuggling in undici",
      severity: "HIGH",
      description:
        "undici < 5.28.4 is vulnerable to HTTP request smuggling due to improper handling of chunked transfer encoding. An attacker can poison the connection pool and intercept or forge requests from other users.",
      fixVersion: "5.28.4",
      cveIds: ["CVE-2024-30260"],
    },
  ],
  next: [
    {
      id: "dep-next-ssrf-middleware-bypass",
      title: "Authorization Bypass via SSRF in Next.js Middleware",
      severity: "CRITICAL",
      description:
        "Next.js < 14.2.25 (14.x) or < 15.2.3 (15.x) is vulnerable to a server-side request forgery that allows bypassing middleware-based authorization checks using a crafted `x-middleware-subrequest` header. Any authentication enforced exclusively in middleware can be circumvented.",
      fixVersion: "14.2.25",
      cveIds: ["CVE-2025-29927"],
    },
  ],
  vm2: [
    {
      id: "dep-vm2-rce",
      title: "Remote Code Execution in vm2 Sandbox",
      severity: "CRITICAL",
      description:
        "vm2 is no longer maintained and contains multiple critical RCE vulnerabilities. Any version allows a sandboxed script to escape the VM context and execute arbitrary code on the host system. Do not use vm2 — migrate to isolated-vm, quickjs-emscripten, or a Worker thread.",
      fixVersion: "99999.0.0", // no safe version exists
      cveIds: ["CVE-2023-29017", "CVE-2023-30547", "CVE-2023-32313"],
    },
  ],
  serialize2javascript: [
    {
      id: "dep-serialize-xss",
      title: "XSS via serialize-javascript",
      severity: "HIGH",
      description:
        "serialize-javascript < 3.1.0 is vulnerable to XSS. Serializing untrusted data that includes special Unicode characters can result in script injection when the output is embedded in an HTML page.",
      fixVersion: "3.1.0",
      cveIds: ["CVE-2020-7660"],
    },
  ],
};

// ─── Scanner ──────────────────────────────────────────────────────────────────

export function scanDependencies(files: FileEntry[]): Finding[] {
  const pkgFile = files.find(
    (f) => f.language === "json" && /(?:^|\/)package\.json$/.test(f.path) && !f.path.includes("node_modules")
  );
  if (!pkgFile) return [];

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(pkgFile.content) as Record<string, unknown>;
  } catch {
    return [];
  }

  const deps: Record<string, string> = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };

  const findings: Finding[] = [];

  for (const [pkgName, vulns] of Object.entries(VULN_DB)) {
    const versionSpec = deps[pkgName];
    if (!versionSpec) continue;

    for (const vuln of vulns) {
      if (!isPotentiallyVulnerable(versionSpec, vuln.fixVersion)) continue;

      const min = parseMinVersion(versionSpec);
      findings.push({
        ruleId: vuln.id,
        filePath: pkgFile.path,
        lineNumber: null,
        lineEnd: null,
        codeSnippet: `"${pkgName}": "${versionSpec}"`,
        severity: vuln.severity,
        category: "dependency",
        title: `Vulnerable dependency: ${pkgName}@${min} — ${vuln.title}`,
        description:
          `${vuln.description} ` +
          `Declared version \`${versionSpec}\` (min: \`${min}\`) is below the safe version \`${vuln.fixVersion}\`. ` +
          `CVE(s): ${vuln.cveIds.join(", ")}.`,
        aiTools: [],
        fixTemplate:
          `# Update ${pkgName} to a patched version:\nnpm install ${pkgName}@>=${vuln.fixVersion}\n# or: pnpm add ${pkgName}@>=${vuln.fixVersion}`,
      });
    }
  }

  return findings;
}
