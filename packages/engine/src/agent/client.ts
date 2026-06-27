import { Agent, CursorAgentError } from "@cursor/sdk";

import type { WathConfig } from "../config/env.js";
import { buildMcpServers } from "../config/mcp.js";

export interface AgentLaunchOptions {
  apiKey: string;
  prompt: string;
  config: WathConfig;
  target: { mode: "cloud"; repoUrl: string } | { mode: "local"; cwd: string };
  autoCreatePR?: boolean;
  onEvent?: (event: AgentStreamEvent) => void;
}

export type AgentStreamEvent =
  | { type: "assistant_text"; text: string }
  | { type: "status"; message: string }
  | { type: "tool"; name: string };

export interface AgentLaunchResult {
  agentId: string;
  runId: string;
  status: string;
  result?: string;
  prUrl?: string;
  durationMs?: number;
}

function relayStreamEvent(event: unknown, onEvent?: (e: AgentStreamEvent) => void): void {
  if (!onEvent || typeof event !== "object" || event === null) return;
  const e = event as { type?: string; message?: { content?: Array<{ type?: string; text?: string }> } };
  if (e.type === "assistant") {
    for (const block of e.message?.content ?? []) {
      if (block.type === "text" && block.text) {
        onEvent({ type: "assistant_text", text: block.text });
      }
    }
  }
}

export async function launchOnboardingAgent(
  options: AgentLaunchOptions
): Promise<AgentLaunchResult> {
  const mcpServers = buildMcpServers(options.config);

  const agentOptions =
    options.target.mode === "cloud"
      ? {
          apiKey: options.apiKey,
          model: { id: options.config.model },
          cloud: {
            repos: [{ url: options.target.repoUrl }],
            autoCreatePR: options.autoCreatePR ?? true,
            skipReviewerRequest: true,
          },
          ...(Object.keys(mcpServers).length ? { mcpServers } : {}),
        }
      : {
          apiKey: options.apiKey,
          model: { id: options.config.model },
          local: {
            cwd: options.target.cwd,
            settingSources: [],
          },
          ...(Object.keys(mcpServers).length ? { mcpServers } : {}),
        };

  await using agent = await Agent.create(agentOptions);

  const run = await agent.send(options.prompt);
  options.onEvent?.({ type: "status", message: `run started: ${run.id}` });

  for await (const event of run.stream()) {
    relayStreamEvent(event, options.onEvent);
  }

  let result;
  try {
    result = await run.wait();
  } catch (err) {
    if (err instanceof CursorAgentError) {
      throw new Error(
        `Agent startup/transport failed: ${err.message} (retryable=${err.isRetryable})`
      );
    }
    throw err;
  }

  if (result.status === "error") {
    throw new Error(`Agent run failed: ${result.id}${result.result ? ` — ${result.result}` : ""}`);
  }

  const prUrl = result.git?.branches?.find((b) => b.prUrl)?.prUrl;

  return {
    agentId: agent.agentId,
    runId: result.id,
    status: result.status,
    result: result.result,
    prUrl,
    durationMs: result.durationMs,
  };
}
