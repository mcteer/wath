/**
 * @cursor/sdk agent wrapper — Phase 4.
 * Agent.create({ cloud: { repos, autoCreatePR } }) → agent.send(onboarding intent)
 */
export interface AgentRunOptions {
  consumerRepo: string;
  prompt: string;
  autoCreatePR?: boolean;
}

export interface AgentRunResult {
  runId: string;
  status: "pending" | "completed" | "failed";
}

export async function launchAgent(
  _options: AgentRunOptions
): Promise<AgentRunResult> {
  throw new Error(
    "Cloud agent launch not yet implemented. See docs/roadmap/03-build-roadmap.md Phase 4."
  );
}
