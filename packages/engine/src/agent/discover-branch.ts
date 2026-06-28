import { resolveApplicationId } from "../lifecycle/state.js";
import { githubApiHeaders, requireGitHubToken } from "../github/token.js";

/** List remote branch names for a GitHub repo. Requires GITHUB_TOKEN. */
export async function listRemoteBranches(repoUrl: string): Promise<string[]> {
  const appId = resolveApplicationId(repoUrl);
  const [org, repo] = appId.split("/");
  const token = requireGitHubToken("branch discovery");
  const res = await fetch(`https://api.github.com/repos/${org}/${repo}/branches?per_page=100`, {
    headers: githubApiHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`GitHub branches API failed for ${appId}: HTTP ${res.status}`);
  }
  const data = (await res.json()) as Array<{ name: string }>;
  return data.map((b) => b.name);
}

/** Newest cursor/* integration branch when the SDK omits git.branches. */
export async function discoverIntegrateBranch(repoUrl: string): Promise<string | undefined> {
  const names = await listRemoteBranches(repoUrl);
  const cursorBranches = names.filter((n) => n.startsWith("cursor/") && n !== "main");
  if (cursorBranches.length === 0) return undefined;
  if (cursorBranches.length === 1) return cursorBranches[0];

  const appId = resolveApplicationId(repoUrl);
  const [org, repo] = appId.split("/");
  const token = requireGitHubToken("branch discovery");
  let newest: { name: string; date: number } | undefined;
  for (const name of cursorBranches) {
    const res = await fetch(
      `https://api.github.com/repos/${org}/${repo}/commits/${encodeURIComponent(name)}`,
      { headers: githubApiHeaders(token) }
    );
    if (!res.ok) continue;
    const commit = (await res.json()) as { commit?: { committer?: { date?: string } } };
    const date = Date.parse(commit.commit?.committer?.date ?? "");
    if (!newest || date > newest.date) newest = { name, date };
  }
  return newest?.name ?? cursorBranches[0];
}

/** Parse branch name from agent summary text when git metadata is missing. */
export function parseBranchFromAgentText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const patterns = [
    /Branch:\s*`([^`]+)`/i,
    /branch\s+`([^`]+)`/i,
    /on branch\s+`?([^\s`]+)`?/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.startsWith("cursor/")) return match[1];
  }
  return undefined;
}
