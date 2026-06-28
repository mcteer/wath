import type { SDKAgent } from "@cursor/sdk";
import { Agent, CursorAgentError } from "@cursor/sdk";

import type { WathConfig } from "../config/env.js";
import { buildMcpServers } from "../config/mcp.js";
import { discoverOpenPrForBranch } from "./discover-pr.js";
import { extractAgentBranch } from "./git.js";

export const DEFAULT_PR_CREATE_RETRIES = 3;

export interface AgentLaunchOptions {
  apiKey: string;
  prompt: string;
  config: WathConfig;
  /** Cloud: GitHub repo URL. Local: workspace directory. */
  target: { mode: "cloud"; repoUrl: string } | { mode: "local"; cwd: string };
  autoCreatePR?: boolean;
  /** Cloud: git ref to check out (integrate branch for validate). */
  startingRef?: string;
  /** Cloud: resume integrate agent instead of spawning a new one. */
  resumeAgentId?: string;
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
  branch?: string;
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

function resolvePrUrl(result: {
  git?: { branches?: Array<{ prUrl?: string }> };
  result?: string;
}): string | undefined {
  const fromGit = result.git?.branches?.find((b) => b.prUrl)?.prUrl;
  if (fromGit) return fromGit;
  const match = result.result?.match(/https:\/\/github\.com\/[^\s)]+\/pull\/\d+/);
  return match?.[0];
}

/** Merge SDK/git metadata, agent text, and GitHub API lookup for an open PR on the branch. */
export async function enrichAgentPrUrl(
  result: AgentLaunchResult,
  repoUrl: string,
  workBranch?: string
): Promise<AgentLaunchResult> {
  if (result.prUrl) return result;
  const branch = result.branch ?? workBranch;
  if (!branch) return result;
  const discovered = await discoverOpenPrForBranch(repoUrl, branch);
  return discovered ? { ...result, prUrl: discovered, branch } : { ...result, branch };
}

export async function executeValidateWithPrRetries(options: {
  run: (prompt: string) => Promise<AgentLaunchResult>;
  validatePrompt: string;
  retryPrompt: (attempt: number) => string;
  repoUrl: string;
  workBranch?: string;
  maxRetries?: number;
  onRetry?: (attempt: number) => void;
}): Promise<AgentLaunchResult> {
  const maxAttempts = options.maxRetries ?? DEFAULT_PR_CREATE_RETRIES;
  let result = await enrichAgentPrUrl(
    await options.run(options.validatePrompt),
    options.repoUrl,
    options.workBranch
  );

  for (let attempt = 1; attempt < maxAttempts && !result.prUrl; attempt++) {
    options.onRetry?.(attempt);
    result = await enrichAgentPrUrl(
      await options.run(options.retryPrompt(attempt)),
      options.repoUrl,
      options.workBranch ?? result.branch
    );
  }

  return result;
}

async function executeAgentRun(
  agent: SDKAgent,
  prompt: string,
  onEvent?: (event: AgentStreamEvent) => void
): Promise<AgentLaunchResult> {
  const run = await agent.send(prompt);
  onEvent?.({ type: "status", message: `run started: ${run.id}` });

  for await (const event of run.stream()) {
    relayStreamEvent(event, onEvent);
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

  return {
    agentId: agent.agentId,
    runId: result.id,
    status: result.status,
    result: result.result,
    prUrl: resolvePrUrl(result),
    branch: extractAgentBranch(result.git?.branches),
    durationMs: result.durationMs,
  };
}

type CloudLaunchBase = Pick<AgentLaunchOptions, "apiKey" | "config" | "target">;

function cloudAgentOptions(
  options: CloudLaunchBase,
  autoCreatePR: boolean,
  extras: { startingRef?: string; workOnCurrentBranch?: boolean } = {}
) {
  const mcpServers = buildMcpServers(options.config);
  return {
    apiKey: options.apiKey,
    model: { id: options.config.model },
    cloud: {
      repos: [
        {
          url: options.target.mode === "cloud" ? options.target.repoUrl : "",
          ...(extras.startingRef ? { startingRef: extras.startingRef } : {}),
        },
      ],
      autoCreatePR,
      skipReviewerRequest: true,
      ...(extras.workOnCurrentBranch ? { workOnCurrentBranch: true } : {}),
    },
    ...(Object.keys(mcpServers).length ? { mcpServers } : {}),
  };
}

/** Launch a Cursor agent (cloud or local) for onboarding. */
export async function launchOnboardingAgent(
  options: AgentLaunchOptions
): Promise<AgentLaunchResult> {
  if (options.resumeAgentId) {
    await using agent = await Agent.resume(
      options.resumeAgentId,
      cloudAgentOptions(options, options.autoCreatePR ?? true, {
        workOnCurrentBranch: options.target.mode === "cloud",
      })
    );
    return executeAgentRun(agent, options.prompt, options.onEvent);
  }

  if (options.target.mode === "cloud") {
    await using agent = await Agent.create(
      cloudAgentOptions(options, options.autoCreatePR ?? true, {
        startingRef: options.startingRef,
      })
    );
    return executeAgentRun(agent, options.prompt, options.onEvent);
  }

  const mcpServers = buildMcpServers(options.config);
  await using agent = await Agent.create({
    apiKey: options.apiKey,
    model: { id: options.config.model },
    local: {
      cwd: options.target.cwd,
      settingSources: [],
    },
    ...(Object.keys(mcpServers).length ? { mcpServers } : {}),
  });
  return executeAgentRun(agent, options.prompt, options.onEvent);
}

/** One cloud agent session: integrate (no PR) then validate (open PR on same branch). */
export async function launchIntegrateValidateChain(
  options: CloudLaunchBase & {
    integratePrompt: string;
    validatePrompt: string;
    retryPrompt: (attempt: number, workBranch?: string) => string;
    maxPrRetries?: number;
    onEvent?: (event: AgentStreamEvent) => void;
    onValidateStart?: () => void | Promise<void>;
    onPrRetry?: (attempt: number) => void;
  }
): Promise<{ integrate: AgentLaunchResult; validate: AgentLaunchResult }> {
  if (options.target.mode !== "cloud") {
    throw new Error("launchIntegrateValidateChain requires cloud target");
  }

  await using agent = await Agent.create(cloudAgentOptions(options, false));

  const integrate = await executeAgentRun(agent, options.integratePrompt, options.onEvent);
  await options.onValidateStart?.();
  const workBranch = integrate.branch;
  const validate = await executeValidateWithPrRetries({
    run: (prompt) => executeAgentRun(agent, prompt, options.onEvent),
    validatePrompt: options.validatePrompt,
    retryPrompt: (attempt) => options.retryPrompt(attempt, workBranch),
    repoUrl: options.target.repoUrl,
    workBranch,
    maxRetries: options.maxPrRetries,
    onRetry: options.onPrRetry,
  });

  return { integrate, validate };
}

type ValidateWithRetriesOptions = CloudLaunchBase & {
  validatePrompt: string;
  retryPrompt: (attempt: number, workBranch?: string) => string;
  workBranch?: string;
  maxPrRetries?: number;
  resumeAgentId?: string;
  startingRef?: string;
  onEvent?: (event: AgentStreamEvent) => void;
  onPrRetry?: (attempt: number) => void;
};

/** Validate on an existing integrate branch with PR-creation retries. */
export async function launchValidateWithPrRetries(
  options: ValidateWithRetriesOptions
): Promise<AgentLaunchResult> {
  if (options.target.mode !== "cloud") {
    throw new Error("launchValidateWithPrRetries requires cloud target");
  }
  const repoUrl = options.target.repoUrl;

  const cloudExtras = {
    startingRef: options.startingRef,
    ...(options.resumeAgentId ? { workOnCurrentBranch: true } : {}),
  };

  let activeBranch = options.workBranch;

  const runWithRetries = async (
    run: (prompt: string) => Promise<AgentLaunchResult>
  ): Promise<AgentLaunchResult> =>
    executeValidateWithPrRetries({
      run,
      validatePrompt: options.validatePrompt,
      retryPrompt: (attempt) => options.retryPrompt(attempt, activeBranch),
      repoUrl: repoUrl,
      workBranch: activeBranch,
      maxRetries: options.maxPrRetries,
      onRetry: options.onPrRetry,
    });

  if (options.resumeAgentId) {
    await using agent = await Agent.resume(
      options.resumeAgentId,
      cloudAgentOptions(options, false, cloudExtras)
    );
    return runWithRetries(async (prompt) => {
      const result = await executeAgentRun(agent, prompt, options.onEvent);
      if (result.branch) activeBranch = result.branch;
      return result;
    });
  }

  await using agent = await Agent.create(cloudAgentOptions(options, false, cloudExtras));
  return runWithRetries(async (prompt) => {
    const result = await executeAgentRun(agent, prompt, options.onEvent);
    if (result.branch) activeBranch = result.branch;
    return result;
  });
}
