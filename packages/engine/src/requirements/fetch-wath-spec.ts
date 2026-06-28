import { parseWathSpecJson } from "./parser.js";
import type { WathSpec } from "./parser.js";
import { githubRawHeaders, requireGitHubToken } from "../github/token.js";
import { resolveApplicationId } from "../lifecycle/state.js";

function normalizeRepoUrl(url: string): string {
  return url.replace(/\.git$/, "").replace(/\/$/, "");
}

/** Fetch wath.json from the default branch on GitHub (tries main, then master). Requires GITHUB_TOKEN. */
export async function fetchWathSpecFromRepo(repoUrl: string): Promise<WathSpec> {
  const appId = resolveApplicationId(repoUrl);
  const [org, repo] = appId.split("/");
  const branches = ["main", "master"];
  const token = requireGitHubToken("wath.json fetch");
  const headers = githubRawHeaders(token);

  let lastStatus = 0;
  for (const branch of branches) {
    const url = `https://raw.githubusercontent.com/${org}/${repo}/${branch}/wath.json`;
    const res = await fetch(url, { headers });
    lastStatus = res.status;
    if (!res.ok) continue;

    const raw = await res.text();
    const spec = parseWathSpecJson(raw, `${repoUrl}@${branch}/wath.json`);
    if (normalizeRepoUrl(spec.repo).toLowerCase() !== normalizeRepoUrl(repoUrl).toLowerCase()) {
      throw new Error(
        `wath.json repo field (${spec.repo}) does not match requested repo (${repoUrl})`
      );
    }
    return spec;
  }

  throw new Error(
    `Could not fetch wath.json from ${repoUrl} (tried branches: ${branches.join(", ")}; last HTTP ${lastStatus})`
  );
}
