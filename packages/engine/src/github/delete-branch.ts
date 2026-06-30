import { resolveApplicationId } from "../lifecycle/state.js";
import { githubApiHeaders } from "./token.js";

const PROTECTED_BRANCHES = new Set(["main", "master"]);

function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
  const appId = resolveApplicationId(repoUrl);
  const [owner, repo] = appId.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repo URL (expected org/repo): ${repoUrl}`);
  }
  return { owner, repo };
}

/** Delete a remote branch ref. No-op for default branches and 404. */
export async function deleteRemoteBranch(
  repoUrl: string,
  branch: string,
  token?: string
): Promise<void> {
  if (PROTECTED_BRANCHES.has(branch)) return;

  const { owner, repo } = parseRepoUrl(repoUrl);
  const url = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`;
  const res = await fetch(url, { method: "DELETE", headers: githubApiHeaders(token) });
  if (res.status === 404) return;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub delete ref ${res.status} for ${branch}: ${body.slice(0, 200)}`);
  }
}
