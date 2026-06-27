import type { OnboardingIntent, ResolvedStandard } from "../types.js";
import {
  deriveRuntime,
  parseRequirements,
  resolveRequirementsPath,
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
  requirementsPath: string;
  runtime: string;
  consumerRepoPath: string;
  consumerRoot: string;
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
 * Compose onboarding context: select the governing standard from the registry
 * based on explicit intent or inferred runtime from requirements.
 */
export function composeOnboardingContext(
  intent: OnboardingIntent
): OnboardingContext {
  const repoRoot = resolveRepoRoot();
  const requirementsPath = resolveRequirementsPath(intent);
  const requirements = parseRequirements(requirementsPath);
  const runtime = deriveRuntime(requirements);
  const consumerRepoPath = intent.consumerRepoPath;

  let standard: ResolvedStandard;
  if (intent.standardId) {
    standard = resolveStandard(repoRoot, intent.standardId);
  } else {
    const candidates = findStandardsForRuntime(repoRoot, runtime);
    if (candidates.length === 0) {
      throw new Error(
        `No standards registered for runtime "${runtime}". Add one to standards/registry.yaml.`
      );
    }
    standard = resolveStandard(repoRoot, candidates[0].id);
  }

  const consumerRoot = resolveConsumerRoot(repoRoot, consumerRepoPath);

  return {
    repoRoot,
    standard,
    requirementsPath,
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
