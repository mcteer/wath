import { resolveApplicationId } from "../lifecycle/state.js";
import { githubApiHeaders, requireGitHubToken } from "../github/token.js";

/** Open PR whose head matches branch. Requires GITHUB_TOKEN. */
export async function discoverOpenPrForBranch(
  repoUrl: string,
  branch: string
): Promise<string | undefined> {
  const appId = resolveApplicationId(repoUrl);
  const [org, repo] = appId.split("/");
  const head = `${org}:${branch}`;
  const url = new URL(`https://api.github.com/repos/${org}/${repo}/pulls`);
  url.searchParams.set("state", "open");
  url.searchParams.set("head", head);
  url.searchParams.set("per_page", "1");

  const res = await fetch(url, { headers: githubApiHeaders(requireGitHubToken("PR discovery")) });
  if (!res.ok) {
    console.error(`[wath] discoverOpenPrForBranch failed for ${appId}@${branch}: HTTP ${res.status}`);
    return undefined;
  }

  const pulls = (await res.json()) as Array<{ html_url?: string }>;
  return pulls[0]?.html_url;
}
