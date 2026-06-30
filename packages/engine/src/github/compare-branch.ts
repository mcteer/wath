import { resolveApplicationId } from "../lifecycle/state.js";
import { githubApiHeaders } from "./token.js";

/** Paths ignored when deciding if a drift remediation PR is necessary. */
export function isEphemeralVerifyPath(path: string): boolean {
  const normalized = path.replace(/^\.\//, "");
  return normalized === ".wath" || normalized.startsWith(".wath/");
}

/** Filter compare API filenames to integration-meaningful changes. */
export function meaningfulIntegrationDiffPaths(files: string[]): string[] {
  return files.filter((f) => !isEphemeralVerifyPath(f));
}

function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
  const appId = resolveApplicationId(repoUrl);
  const [owner, repo] = appId.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repo URL (expected org/repo): ${repoUrl}`);
  }
  return { owner, repo };
}

/** List files changed on headBranch relative to baseBranch via GitHub compare API. */
export async function listBranchDiffFiles(
  repoUrl: string,
  headBranch: string,
  baseBranch = "main",
  token?: string
): Promise<string[]> {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(headBranch)}`;
  const res = await fetch(compareUrl, { headers: githubApiHeaders(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub compare ${res.status} for ${headBranch}...${baseBranch}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { files?: Array<{ filename?: string }> };
  return (data.files ?? [])
    .map((f) => f.filename)
    .filter((name): name is string => Boolean(name));
}
