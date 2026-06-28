import { resolveApplicationId } from "../lifecycle/state.js";
import { githubApiHeaders, resolveGitHubToken } from "./token.js";

export interface OpenWathPr {
  prUrl: string;
  branch: string;
  title: string;
  standardId?: string;
}

/** Parse standard id from PR title: `Wath onboarding: <id> for ...` */
export function parseStandardIdFromWathPrTitle(title: string): string | undefined {
  const match = title.match(/Wath onboarding:\s*([^\s]+)\s+for/i);
  return match?.[1];
}

function isWathPr(title: string, branch: string): boolean {
  if (/^Wath onboarding:/i.test(title)) return true;
  return branch.startsWith("cursor/");
}

/** List open PRs on a repo that look like Wath onboarding work. Requires GITHUB_TOKEN. */
export async function listOpenWathPrs(repoUrl: string): Promise<OpenWathPr[]> {
  const token = resolveGitHubToken();
  if (!token) return [];

  const appId = resolveApplicationId(repoUrl);
  const [org, repo] = appId.split("/");
  const url = new URL(`https://api.github.com/repos/${org}/${repo}/pulls`);
  url.searchParams.set("state", "open");
  url.searchParams.set("per_page", "100");

  const res = await fetch(url, { headers: githubApiHeaders(token) });
  if (!res.ok) {
    console.error(`[wath] listOpenWathPrs failed for ${appId}: HTTP ${res.status}`);
    return [];
  }

  const pulls = (await res.json()) as Array<{
    html_url?: string;
    title?: string;
    head?: { ref?: string };
  }>;

  const out: OpenWathPr[] = [];
  for (const pr of pulls) {
    const branch = pr.head?.ref ?? "";
    const title = pr.title ?? "";
    if (!pr.html_url || !isWathPr(title, branch)) continue;
    out.push({
      prUrl: pr.html_url,
      branch,
      title,
      standardId: parseStandardIdFromWathPrTitle(title),
    });
  }
  return out;
}

/** First open Wath PR, optionally filtered by standard id. */
export async function discoverOpenWathPr(
  repoUrl: string,
  standardId?: string
): Promise<OpenWathPr | undefined> {
  const open = await listOpenWathPrs(repoUrl);
  if (standardId) {
    return open.find((p) => p.standardId === standardId) ?? open[0];
  }
  return open[0];
}
