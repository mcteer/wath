import { artifactPrSectionMarkdown } from "../onboarding/artifacts.js";
import { resolveApplicationId } from "../lifecycle/state.js";
import { resolveStandard } from "../standards/registry.js";
import { discoverOpenPrForBranch } from "./discover-pr.js";

function parseRepo(repoUrl: string): { org: string; repo: string; appId: string } {
  const appId = resolveApplicationId(repoUrl);
  const [org, repo] = appId.split("/");
  return { org, repo, appId };
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "wath-engine",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function fetchBranchFileText(
  repoUrl: string,
  path: string,
  ref: string,
  token?: string
): Promise<string | undefined> {
  const { org, repo } = parseRepo(repoUrl);
  const url = `https://api.github.com/repos/${org}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    headers: token
      ? githubHeaders(token)
      : { Accept: "application/vnd.github+json", "User-Agent": "wath-engine" },
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (data.encoding !== "base64" || !data.content) return undefined;
  return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
}

export async function fetchAppNameFromBranch(
  repoUrl: string,
  branch: string,
  token?: string
): Promise<string | undefined> {
  const raw = await fetchBranchFileText(repoUrl, "integration.params.json", branch, token);
  if (!raw) return undefined;
  try {
    const params = JSON.parse(raw) as { app_name?: string };
    return params.app_name?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function buildIntegrationPrTitle(standardId: string, appName?: string): string {
  if (appName) return `Wath onboarding: ${standardId} for ${appName}`;
  return `Wath onboarding: ${standardId}`;
}

export function buildIntegrationPrBody(
  repoRoot: string,
  standardId: string,
  branch: string,
  appName?: string
): string {
  const standard = resolveStandard(repoRoot, standardId);
  const appLine = appName ? `\n- **App:** ${appName}` : "";
  return `## Wath onboarding — ${standardId}

Opened by wath-core after cloud agent validation (Cursor autoCreatePR requires manual approval).

- **Standard:** \`${standardId}\` v${standard.entry.version}${appLine}
- **Branch:** \`${branch}\`

### Artifacts in this PR

${artifactPrSectionMarkdown(standard)}

### Verification evidence

See \`.wath/verify-summary.json\` on the branch.
`;
}

/** Create an integration PR when the cloud agent did not return a PR URL. */
export async function ensureIntegrationPrUrl(options: {
  repoUrl: string;
  branch: string;
  standardId: string;
  repoRoot: string;
  githubToken?: string;
  baseBranch?: string;
}): Promise<string | undefined> {
  const existing = await discoverOpenPrForBranch(options.repoUrl, options.branch);
  if (existing) return existing;

  const token = options.githubToken?.trim();
  if (!token) {
    console.error(
      "[wath] no PR URL from agent and GITHUB_TOKEN unset — cannot open PR via GitHub API"
    );
    return undefined;
  }

  const { org, repo } = parseRepo(options.repoUrl);
  const appName = await fetchAppNameFromBranch(options.repoUrl, options.branch, token);
  const title = buildIntegrationPrTitle(options.standardId, appName);
  const body = buildIntegrationPrBody(
    options.repoRoot,
    options.standardId,
    options.branch,
    appName
  );

  const res = await fetch(`https://api.github.com/repos/${org}/${repo}/pulls`, {
    method: "POST",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      head: options.branch,
      base: options.baseBranch ?? "main",
      body,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error(`[wath] GitHub create PR failed: HTTP ${res.status} ${detail}`);
    return undefined;
  }

  const pull = (await res.json()) as { html_url?: string };
  return pull.html_url;
}
