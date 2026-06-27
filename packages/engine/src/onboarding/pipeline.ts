import type { OnboardingIntent, ResolvedStandard } from "../types.js";
import {
  deriveRuntime,
  listRequestedStandardIds,
  parseWathSpec,
  resolveWathPath,
} from "../requirements/parser.js";
import {
  findStandardsForRuntime,
  resolveRepoRoot,
  resolveStandard,
} from "../standards/registry.js";
import { loadConfig, requireApiKey } from "../config/env.js";
import { launchOnboardingAgent } from "../agent/client.js";
import { buildOnboardingPrompt } from "./prompt.js";
import {
  materializeConsumerConfig,
  resolveConsumerRepoUrl,
  resolveConsumerRoot,
} from "./materialize.js";

export interface OnboardingContext {
  repoRoot: string;
  standard: ResolvedStandard;
  wathPath: string;
  requestedStandardIds: string[];
  runtime: string;
  consumerRepoPath: string;
  consumerRoot: string;
  /** @deprecated Use wathPath */
  integrationsPath: string;
}

export interface OnboardingOptions {
  dryRun?: boolean;
  launch?: boolean;
  local?: boolean;
  materialize?: boolean;
  forceMaterialize?: boolean;
  autoCreatePR?: boolean;
  repoUrl?: string;
}

export interface OnboardingResult {
  context: OnboardingContext;
  prompt: string;
  materialized?: { filesWritten: string[] };
  agent?: {
    agentId: string;
    runId: string;
    status: string;
    prUrl?: string;
    durationMs?: number;
  };
}

/**
 * Pick the governing standard: explicit --standard-id, first listed service in the spec,
 * or first registry match for runtime.
 */
function resolveStandardForSpec(
  repoRoot: string,
  specStandardIds: string[],
  runtime: string,
  explicitId?: string
): ResolvedStandard {
  if (explicitId) {
    return resolveStandard(repoRoot, explicitId);
  }
  for (const id of specStandardIds) {
    try {
      return resolveStandard(repoRoot, id);
    } catch {
      continue;
    }
  }
  const candidates = findStandardsForRuntime(repoRoot, runtime);
  if (candidates.length === 0) {
    throw new Error(
      `No standards registered for runtime "${runtime}". Add one to standards/registry.yaml.`
    );
  }
  return resolveStandard(repoRoot, candidates[0].id);
}

/**
 * Compose onboarding context from wath.json and the standards registry.
 */
export function composeOnboardingContext(
  intent: OnboardingIntent
): OnboardingContext {
  const repoRoot = resolveRepoRoot();
  const wathPath = resolveWathPath(intent);
  const spec = parseWathSpec(wathPath);
  const runtime = deriveRuntime(spec);
  const requestedStandardIds = listRequestedStandardIds(spec);
  const consumerRepoPath = intent.consumerRepoPath;

  const standard = resolveStandardForSpec(
    repoRoot,
    requestedStandardIds,
    runtime,
    intent.standardId
  );

  const consumerRoot = resolveConsumerRoot(repoRoot, consumerRepoPath);

  return {
    repoRoot,
    standard,
    wathPath,
    integrationsPath: wathPath,
    requestedStandardIds,
    runtime,
    consumerRepoPath,
    consumerRoot,
  };
}

/**
 * Full onboarding pipeline: compose → materialize config → (optional) launch agent.
 */
export async function runOnboarding(
  intent: OnboardingIntent,
  options: OnboardingOptions = {}
): Promise<OnboardingResult> {
  const config = loadConfig();
  if (options.repoUrl) {
    config.consumerRepoUrl = options.repoUrl;
  }

  const context = composeOnboardingContext(intent);
  const prompt = buildOnboardingPrompt(context);

  const result: OnboardingResult = { context, prompt };

  const shouldMaterialize = options.materialize !== false && (options.launch || options.materialize);
  if (shouldMaterialize) {
    result.materialized = materializeConsumerConfig(context, config, {
      force: options.forceMaterialize,
    });
  }

  const dryRun = options.dryRun ?? !options.launch;
  if (dryRun) {
    return result;
  }

  const apiKey = requireApiKey(config);
  const useLocal = options.local ?? false;

  const agentResult = await launchOnboardingAgent({
    apiKey,
    prompt,
    config,
    autoCreatePR: options.autoCreatePR ?? true,
    target: useLocal
      ? { mode: "local", cwd: context.repoRoot }
      : {
          mode: "cloud",
          repoUrl: resolveConsumerRepoUrl(context, config),
        },
    onEvent: (event) => {
      if (event.type === "assistant_text") {
        process.stdout.write(event.text);
      } else if (event.type === "status") {
        console.error(`[wath] ${event.message}`);
      }
    },
  });

  result.agent = agentResult;
  return result;
}
