import { loadConfig, requireApiKey } from "../config/env.js";
import { launchOnboardingAgent } from "../agent/client.js";
import { composeOnboardingContext } from "../onboarding/pipeline.js";
import { materializeConsumerConfig, resolveConsumerRepoUrl } from "../onboarding/materialize.js";
import { resolveConsumer } from "../onboarding/resolve-consumer.js";
import { parseWathSpec, resolveWathPath } from "../requirements/parser.js";
import { writeWathFeedback } from "../requirements/writer.js";
import { resolveRepoRoot, resolveStandard } from "../standards/registry.js";
import { runConformanceGate } from "../verify/runner.js";
import type { OnboardingIntent } from "../types.js";
import { applyAuditToState, runComplianceAudit } from "./audit.js";
import {
  allIntegrationsMerged,
  isManifestComplete,
  nextPendingStandardId,
} from "./manifest.js";
import { recordAgentPr, markVerifyResult } from "./merge.js";
import {
  buildIntegratePrompt,
  buildManifestEnrichmentPrompt,
  buildValidatePrompt,
} from "./prompts.js";
import {
  appendHistory,
  loadApplicationState,
  loadOrInitState,
  resolveApplicationId,
  saveApplicationState,
} from "./state.js";
import type {
  ApplicationState,
  LifecycleOptions,
  LifecycleResult,
  OnboardingPhase,
  AuditReport,
} from "./types.js";
import type { RecordMergeInput } from "./merge.js";
import { recordMerge as doRecordMerge } from "./merge.js";

function resolveEffectivePhase(
  state: ApplicationState,
  spec: ReturnType<typeof parseWathSpec>,
  forced?: OnboardingPhase
): OnboardingPhase {
  if (forced) return forced;

  if (state.phase === "await_merge") return "await_merge";
  if (state.phase === "compliant" && allIntegrationsMerged(spec, state.integrations)) {
    return "compliant";
  }

  if (state.manifest.status === "pending_pr") return "await_merge";

  if (state.manifest.status !== "accepted") {
    if (!isManifestComplete(spec)) return "enrich_manifest";
    state.manifest.status = "accepted";
  }

  if (allIntegrationsMerged(spec, state.integrations)) return "compliant";

  const next = nextPendingStandardId(spec, state.integrations);
  if (!next) {
    const open = Object.values(state.integrations).some((i) => i.status === "pr_open");
    return open ? "await_merge" : "integrate";
  }

  if (state.phase === "validate" && state.current_standard_id) return "validate";
  return "integrate";
}

function awaitMergePrompt(state: ApplicationState): string {
  const lines = ["# Awaiting human merge", "", "Open PRs:"];
  if (state.manifest.pr_url) lines.push(`- Manifest: ${state.manifest.pr_url}`);
  for (const [id, entry] of Object.entries(state.integrations)) {
    if (entry.pr_url && entry.status === "pr_open") {
      lines.push(`- ${id}: ${entry.pr_url}`);
    }
  }
  lines.push("", "After merge, run `wath record-merge` or MCP `wath.record_merge`.");
  return lines.join("\n");
}

/** Multi-phase onboarding orchestrator. */
export async function runLifecycle(
  intent: OnboardingIntent,
  options: LifecycleOptions = {}
): Promise<LifecycleResult> {
  const config = loadConfig();
  if (options.repoUrl) config.consumerRepoUrl = options.repoUrl;

  const repoRoot = resolveRepoRoot();
  const resolvedConsumer = await resolveConsumer(
    {
      consumerRepoPath: intent.consumerRepoPath,
      target: options.target ?? options.repoUrl,
      repoUrl: options.repoUrl,
      consumerRepoHeader: options.consumerRepoHeader,
    },
    repoRoot
  );

  const wathPath =
    resolvedConsumer.wathPath ?? `${resolvedConsumer.repo}/wath.json`;
  intent = {
    ...intent,
    wathSpec: resolvedConsumer.wathSpec,
    localConsumerPath: resolvedConsumer.localConsumerPath,
    consumerRepoPath: resolvedConsumer.localConsumerPath,
    wathPath,
  };

  const spec = resolvedConsumer.wathSpec;
  const { appId, state } = loadOrInitState(repoRoot, spec, wathPath);

  const phase = resolveEffectivePhase(state, spec, options.phase);
  state.phase = phase;

  let standardId =
    options.standardId ??
    state.current_standard_id ??
    nextPendingStandardId(spec, state.integrations);

  if (phase === "integrate" || phase === "validate") {
    if (state.manifest.status !== "accepted") {
      throw new Error(
        "Manifest not accepted. Merge the wath.json PR and run: wath record-merge --app <org/repo> --type manifest"
      );
    }
    if (!standardId) {
      saveApplicationState(repoRoot, appId, state);
      return {
        appId,
        phase: allIntegrationsMerged(spec, state.integrations) ? "compliant" : "await_merge",
        state,
        prompt: awaitMergePrompt(state),
      };
    }
    state.current_standard_id = standardId;
    intent = { ...intent, standardId };
  }

  let prompt: string;
  switch (phase) {
    case "enrich_manifest":
      prompt = buildManifestEnrichmentPrompt(composeOnboardingContext(intent));
      break;
    case "integrate":
      prompt = buildIntegratePrompt(composeOnboardingContext(intent), standardId!);
      break;
    case "validate":
      prompt = buildValidatePrompt(composeOnboardingContext(intent), standardId!);
      break;
    case "await_merge":
      prompt = awaitMergePrompt(state);
      break;
    case "compliant":
      prompt = "# Onboarding complete\nAll requested integrations are merged and compliant.";
      break;
    default:
      prompt = buildManifestEnrichmentPrompt(composeOnboardingContext(intent));
  }

  appendHistory(state, `phase_${phase}`);
  saveApplicationState(repoRoot, appId, state);

  const result: LifecycleResult = {
    appId,
    phase,
    state,
    prompt,
    resolvedConsumer: {
      repo: resolvedConsumer.repo,
      appId: resolvedConsumer.appId,
      source: resolvedConsumer.source,
      localConsumerPath: resolvedConsumer.localConsumerPath,
    },
  };
  const context = composeOnboardingContext(intent);

  const shouldMaterialize =
    options.materialize !== false &&
    (options.launch || options.materialize) &&
    Boolean(resolvedConsumer.localConsumerPath);
  if (shouldMaterialize && phase !== "await_merge" && phase !== "compliant") {
    result.materialized = materializeConsumerConfig(context, config, {
      force: options.forceMaterialize,
    });
  }

  const dryRun = options.dryRun ?? !options.launch;

  if (dryRun && phase === "validate" && standardId && resolvedConsumer.wathPath) {
    const standard = resolveStandard(repoRoot, standardId);
    const gate = runConformanceGate(standard, context.consumerRoot);
    if (!gate.passed) {
      writeWathFeedback(resolvedConsumer.wathPath, standardId, {
        verify_failed: true,
        output: gate.output.slice(0, 4000),
      });
      markVerifyResult(appId, standardId, false);
      result.state = loadApplicationState(repoRoot, appId)!;
    }
  }

  if (dryRun || phase === "await_merge" || phase === "compliant") {
    return result;
  }

  const apiKey = requireApiKey(config);
  const agentResult = await launchOnboardingAgent({
    apiKey,
    prompt,
    config,
    autoCreatePR: phase === "validate" || phase === "enrich_manifest",
    target: options.local
      ? { mode: "local", cwd: context.consumerRoot }
      : { mode: "cloud", repoUrl: resolveConsumerRepoUrl(context, config) },
    onEvent: (event) => {
      if (event.type === "assistant_text") process.stdout.write(event.text);
      else if (event.type === "status") console.error(`[wath] ${event.message}`);
    },
  });

  result.agent = agentResult;

  if (phase === "enrich_manifest" && agentResult.prUrl) {
    recordAgentPr(appId, "manifest", agentResult.prUrl);
    result.state = loadApplicationState(repoRoot, appId)!;
  } else if (phase === "validate" && agentResult.prUrl && standardId) {
    recordAgentPr(appId, "integration", agentResult.prUrl, standardId);
    result.state = loadApplicationState(repoRoot, appId)!;
  } else if (phase === "integrate") {
    state.phase = "validate";
    appendHistory(state, "integrate_complete", standardId);
    saveApplicationState(repoRoot, appId, state);
    result.state = state;
  }

  const chainValidate =
    options.launch &&
    options.throughValidate !== false &&
    !options._chainValidate &&
    phase === "integrate" &&
    result.agent?.status === "finished";

  if (chainValidate) {
    const validateResult = await runLifecycle(intent, {
      ...options,
      _chainValidate: true,
    });
    return {
      ...validateResult,
      integrateAgent: result.agent,
    };
  }

  return result;
}

export function getLifecycleStatus(
  consumerPathOrAppId: string,
  wathPathOption?: string
): { appId: string; state: ApplicationState | null; spec?: ReturnType<typeof parseWathSpec> } {
  const repoRoot = resolveRepoRoot();

  if (consumerPathOrAppId.includes("github.com")) {
    const appId = resolveApplicationId(consumerPathOrAppId);
    return { appId, state: loadApplicationState(repoRoot, appId) };
  }

  if (/^[^/]+\/[^/]+$/.test(consumerPathOrAppId)) {
    return {
      appId: consumerPathOrAppId,
      state: loadApplicationState(repoRoot, consumerPathOrAppId),
    };
  }

  const intent: OnboardingIntent = {
    consumerRepoPath: consumerPathOrAppId,
    ...(wathPathOption ? { wathPath: wathPathOption } : {}),
  };
  const wathPath = resolveWathPath(intent);
  const spec = parseWathSpec(wathPath);
  const appId = resolveApplicationId(spec.repo);
  return { appId, state: loadApplicationState(repoRoot, appId), spec };
}

export function recordMerge(input: RecordMergeInput): ApplicationState {
  return doRecordMerge(input);
}

export function audit(options: { apply?: boolean; wathRoot?: string } = {}): AuditReport {
  if (options.apply) return applyAuditToState(options.wathRoot);
  return runComplianceAudit(options.wathRoot);
}

export { resolveApplicationId, loadApplicationState, saveApplicationState } from "./state.js";
