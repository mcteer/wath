/** Resolve GitHub API token from environment. */
export function resolveGitHubToken(): string | undefined {
  return process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || undefined;
}

/** Require a GitHub token — unauthenticated API is capped at ~60 requests/hour per IP. */
export function requireGitHubToken(feature = "GitHub API access"): string {
  const token = resolveGitHubToken();
  if (!token) {
    throw new Error(
      `${feature} requires GITHUB_TOKEN (or GH_TOKEN). Set it in deploy/.env — unauthenticated GitHub API is rate-limited to ~60 requests/hour.`
    );
  }
  return token;
}

/** Standard headers for api.github.com REST calls. */
export function githubApiHeaders(token?: string): Record<string, string> {
  const resolved = token ?? requireGitHubToken();
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "wath-engine",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${resolved}`,
  };
}

/** Headers for raw.githubusercontent.com (wath.json fetch). */
export function githubRawHeaders(token?: string): Record<string, string> {
  const resolved = token ?? requireGitHubToken();
  return {
    Accept: "application/vnd.github.raw",
    "User-Agent": "wath-engine",
    Authorization: `Bearer ${resolved}`,
  };
}
