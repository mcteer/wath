/** Extract the primary git branch from a finished Cloud Agent run. */
export function extractAgentBranch(
  branches: Array<{ branch?: string; prUrl?: string }> | undefined
): string | undefined {
  if (!branches?.length) return undefined;
  const withoutPr = branches.find((b) => b.branch && !b.prUrl);
  if (withoutPr?.branch) return withoutPr.branch;
  return branches.find((b) => b.branch)?.branch;
}
