/** Parse https://github.com/{owner}/{repo}/pull/{n} */
export function parseGitHubPrUrl(
  url: string
): { owner: string; repo: string; number: number } | null {
  const trimmed = url.trim().replace(/\/$/, "");
  const match = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/.*)?$/i
  );
  if (!match) return null;
  const number = Number(match[3]);
  if (!Number.isFinite(number) || number < 1) return null;
  return { owner: match[1], repo: match[2], number };
}
