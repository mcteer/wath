import { parseGitHubPrUrl } from "./pr-url.js";
import { githubApiHeaders } from "./token.js";

export interface GitHubPullRequestState {
  state: string;
  merged: boolean;
}

/** Fetch PR state from GitHub REST API. Returns null when the PR does not exist. */
export async function fetchPullRequestState(
  prUrl: string,
  token?: string
): Promise<GitHubPullRequestState | null> {
  const parsed = parseGitHubPrUrl(prUrl);
  if (!parsed) {
    throw new Error(`Not a GitHub pull request URL: ${prUrl}`);
  }

  const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`;
  const res = await fetch(apiUrl, { headers: githubApiHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} for ${prUrl}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { state?: string; merged?: boolean };
  return {
    state: data.state ?? "unknown",
    merged: Boolean(data.merged),
  };
}

export async function isPullRequestMerged(prUrl: string, token?: string): Promise<boolean> {
  const pr = await fetchPullRequestState(prUrl, token);
  return Boolean(pr?.merged);
}
