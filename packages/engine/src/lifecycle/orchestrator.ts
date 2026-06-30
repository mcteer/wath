import { loadConfig, requireApiKey } from "../config/env.js";
import {
  launchIntegrateValidateChain,
  launchOnboardingAgent,
  launchValidateWithPrRetries,
} from "../agent/client.js";
import { composeOnboardingContext } from "../onboarding/pipeline.js";
import { materializeConsumerConfig, resolveConsumerRepoUrl } from "../onboarding/materialize.js";
import { resolveConsumer } from "../onboarding/resolve-consumer.js";
import { parseWathSpec, resolveWathPath } from "../requirements/parser.js";
import { resolveRepoRoot, resolveStandard } from "../standards/registry.js";
import { runConformanceGate } from "../verify/runner.js";
import type { OnboardingIntent } from "../types.js";
import { applyAuditToState, runComplianceAudit } from "./audit.js";
import {
  allIntegrationsMerged,
  isManifestComplete,
  nextDriftStandardId,
  nextPendingStandardId,
} from "./manifest.js";
import { recordAgentPr } from "./merge.js";
import { finalizeIntegrationValidate } from "./finalize-validate.js";
import {
  buildIntegratePrompt,
  buildCreatePrRetryPrompt,
  buildManifestEnrichmentPrompt,
  buildValidatePrompt,
} from "./prompts.js";
import { resolveDriftRemediation, type DriftRemediationInfo } from "./drift-context.js";
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
import { tryAcquireOnboardLock, releaseOnboardLock } from "./in-flight.js";
import {
  integratingProgress,
  driftResolvedProgress,
  prSubmittedProgress,
  validatingProgress,
} from "./progress.js";
import type { LifecycleProgressUpdate } from "./types.js";
import type { AgentLaunchResult } from "../agent/client.js";
import {
  discoverIntegrateBranch,
  parseBranchFromAgentText,
} from "../agent/discover-branch.js";
import { resolveEffectivePhase } from "./phase.js";
import { reconcileInFlightArtifacts } from "./reconcile-github.js";
import {
  beginActiveRun,
  completeActiveRun,
  failActiveRun,
  isActiveRunStale,
  loadActiveRun,
  recordActiveRunProgress,
  toActiveRunStatusView,
  tryClaimActiveRun,
  type ActiveRunStatusView,
} from "./run-progress.js";

function findExistingOpenPr(
  state: ApplicationState,
  phase: OnboardingPhase,
  standardId?: string
): string | undefined {
  if (phase === "enrich_manifest") {
    if (state.manifest.status === "pending_pr" && state.manifest.pr_url) {
      return state.manifest.pr_url;
    }
  }
  if ((phase === "validate" || phase === "integrate") && standardId) {
    const entry = state.integrations[standardId];
    if (entry?.status === "pr_open" && entry.pr_url) {
      return entry.pr_url;
    }
  }
  return undefined;
}

async function notifyProgress(
  options: LifecycleOptions,
  appId: string,
  update: LifecycleProgressUpdate,
  state?: ApplicationState,
  persistState?: () => void
): Promise<void> {
  if (state && update.stage === "validating") {
    if (state.phase !== "validate") {
      state.phase = "validate";
      appendHistory(state, "phase_validate");
      persistState?.();
    }
    if (update.standardId && update.branch && update.branch !== "main" && update.branch !== "master") {
      const entry = state.integrations[update.standardId];
      if (entry && entry.work_branch !== update.branch) {
        entry.work_branch = update.branch;
        appendHistory(state, "integrate_branch", update.branch);
        persistState?.();
      }
    }
  }

  if (options.trackProgress !== false) {
    recordActiveRunProgress(appId, update);
  }
  await options.onProgress?.(update);
}


function finishTrackedRun(
  appId: string,
  options: LifecycleOptions,
  result: LifecycleResult
): LifecycleResult {
  if (options.trackProgress !== false) {
    result.phase = result.state.phase;
    completeActiveRun(appId, result);
  }
  return result;
}

async function resolveIntegrateBranch(
  repoUrl: string,
  agentResult: AgentLaunchResult
): Promise<string | undefined> {
  if (agentResult.branch) return agentResult.branch;
  const fromText = parseBranchFromAgentText(agentResult.result);
  if (fromText) return fromText;
  try {
    return await discoverIntegrateBranch(repoUrl);
  } catch (err) {
    console.error(`[wath] discoverIntegrateBranch failed: ${err}`);
    return undefined;
  }
}

function skippedLaunchResult(
  appId: string,
  state: ApplicationState,
  skipReason: LifecycleResult["skipReason"],
  existingPrUrl: string | undefined,
  extras: Partial<LifecycleResult> = {}
): LifecycleResult {
  return {
    appId,
    phase: "await_merge",
    state,
    prompt: awaitMergePrompt(state),
    skipped: true,
    skipReason,
    existingPrUrl,
    ...extras,
  };
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


function maxPrRetries(options: LifecycleOptions): number {
  return options.maxRetries ?? 3;
}

function persistIntegrateOutcome(
  state: ApplicationState,
  standardId: string,
  agentResult: AgentLaunchResult,
  branch: string | undefined
): void {
  const entry = state.integrations[standardId];
  if (!entry) return;
  entry.integrate_agent_id = agentResult.agentId;
  if (branch) {
    entry.work_branch = branch;
    appendHistory(state, "integrate_branch", branch);
  }
  appendHistory(state, "integrate_agent", agentResult.agentId);
}

function recordPrCreateFailure(
  state: ApplicationState,
  standardId: string,
  attempt: number
): void {
  const entry = state.integrations[standardId];
  if (!entry) return;
  entry.retry_count = (entry.retry_count ?? 0) + 1;
  state.phase = "validate";
  appendHistory(state, "pr_create_failed", `${standardId} after ${attempt} attempt(s)`);
}

async function applyValidateFinalize(input: {
  appId: string;
  standardId: string;
  repoUrl: string;
  driftRemediation: DriftRemediationInfo | null;
  agentResult: AgentLaunchResult;
  workBranch?: string;
  state: ApplicationState;
  prRetries: number;
  options: LifecycleOptions;
}): Promise<{ state: ApplicationState; prUrl?: string }> {
  const outcome = await finalizeIntegrationValidate({
    appId: input.appId,
    standardId: input.standardId,
    repoUrl: input.repoUrl,
    driftRemediation: input.driftRemediation,
    agentResult: input.agentResult,
    workBranch: input.workBranch,
    state: input.state,
  });

  if (outcome.kind === "pr_opened") {
    await notifyProgress(
      input.options,
      input.appId,
      prSubmittedProgress(input.standardId, outcome.prUrl)
    );
    return { state: outcome.state, prUrl: outcome.prUrl };
  }

  if (outcome.kind === "drift_no_pr") {
    const version = input.driftRemediation?.toVersion ?? 0;
    await notifyProgress(
      input.options,
      input.appId,
      driftResolvedProgress(input.standardId, version)
    );
    return { state: outcome.state };
  }

  recordPrCreateFailure(input.state, input.standardId, input.prRetries);
  saveApplicationState(resolveRepoRoot(), input.appId, input.state);
  return { state: input.state };
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
      repo: options.repo,
      target: options.target ?? options.repoUrl ?? options.repo,
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
  const dryRun = options.dryRun ?? !options.launch;
  const { appId, state } = loadOrInitState(repoRoot, spec, wathPath);

  const persistState = (): void => {
    if (dryRun) return;
    saveApplicationState(repoRoot, appId, state);
  };

  const phase = resolveEffectivePhase(state, spec, options.phase);
  state.phase = phase;

  let standardId =
    options.standardId ??
    state.current_standard_id ??
    nextPendingStandardId(spec, state.integrations) ??
    nextDriftStandardId(spec, state.integrations);

  if (phase === "integrate" || phase === "validate") {
    if (state.manifest.status !== "accepted") {
      throw new Error(
        "Manifest not accepted. Merge the wath.json PR and run: wath record-merge --app <org/repo> --type manifest"
      );
    }
    if (!standardId) {
      persistState();
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
  const driftRemediation =
    standardId && phase !== "enrich_manifest"
      ? resolveDriftRemediation(repoRoot, standardId, state.integrations[standardId])
      : null;

  switch (phase) {
    case "enrich_manifest":
      prompt = buildManifestEnrichmentPrompt(composeOnboardingContext(intent));
      break;
    case "integrate":
      prompt = driftRemediation
        ? buildValidatePrompt(composeOnboardingContext(intent), standardId!, "main", {
            driftRemediation,
            verifyOnMain: true,
          })
        : buildIntegratePrompt(composeOnboardingContext(intent), standardId!);
      break;
    case "validate":
      prompt = buildValidatePrompt(
        composeOnboardingContext(intent),
        standardId!,
        state.integrations[standardId!]?.work_branch ?? undefined,
        driftRemediation ? { driftRemediation } : undefined
      );
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
  persistState();

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
    options.materialize === true && Boolean(resolvedConsumer.localConsumerPath);
  if (shouldMaterialize && phase !== "await_merge" && phase !== "compliant") {
    result.materialized = materializeConsumerConfig(context, config, {
      force: options.forceMaterialize,
    });
  }

  if (dryRun && phase === "validate" && standardId && resolvedConsumer.wathPath) {
    const standard = resolveStandard(repoRoot, standardId);
    const gate = runConformanceGate(standard, context.consumerRoot);
    if (!gate.passed) {
      result.state = {
        ...state,
        integrations: {
          ...state.integrations,
          [standardId]: {
            ...state.integrations[standardId],
            last_verify: "failed",
          },
        },
      };
    }
  }

  if (dryRun || phase === "await_merge" || phase === "compliant") {
    return result;
  }

  const ownsLock = !options._chainValidate;
  if (ownsLock) {
    const lock = tryAcquireOnboardLock(appId, phase);
    if (!lock.acquired) {
      const fresh = loadApplicationState(repoRoot, appId) ?? state;
      return skippedLaunchResult(appId, fresh, "onboard_in_progress", undefined, {
        resolvedConsumer: result.resolvedConsumer,
      });
    }
  }

  try {
    if (options.trackProgress !== false && ownsLock) {
      const existing = loadActiveRun(appId, repoRoot);
      if (!(existing?.status === "running" && !isActiveRunStale(existing))) {
        const claim = tryClaimActiveRun(appId, repoRoot);
        if (!claim.claimed) {
          const fresh = loadApplicationState(repoRoot, appId) ?? state;
          return finishTrackedRun(
            appId,
            options,
            skippedLaunchResult(appId, fresh, "onboard_in_progress", undefined, {
              resolvedConsumer: result.resolvedConsumer,
            })
          );
        }
      }
    } else if (options.trackProgress !== false) {
      const active = loadActiveRun(appId, repoRoot);
      if (!active || active.status !== "running" || isActiveRunStale(active)) {
        beginActiveRun(appId, repoRoot);
      }
    }
    let freshBeforeLaunch = loadApplicationState(repoRoot, appId) ?? state;
    if (options.launch && !options.local) {
      const reconciled = await reconcileInFlightArtifacts(repoRoot, appId, freshBeforeLaunch, {
        standardId,
      });
      freshBeforeLaunch = reconciled.state;
    }
    const existingPr = findExistingOpenPr(freshBeforeLaunch, phase, standardId);
    if (existingPr) {
      if (standardId) {
        await notifyProgress(options, appId, prSubmittedProgress(standardId, existingPr), state, persistState);
      }
      return finishTrackedRun(
        appId,
        options,
        skippedLaunchResult(appId, freshBeforeLaunch, "pr_already_open", existingPr, {
          resolvedConsumer: result.resolvedConsumer,
        })
      );
    }

    const apiKey = requireApiKey(config);
    const agentTarget = options.local
      ? { mode: "local" as const, cwd: context.consumerRoot }
      : { mode: "cloud" as const, repoUrl: resolveConsumerRepoUrl(context, config) };
    const onAgentEvent = (event: { type: string; text?: string; message?: string }): void => {
      if (event.type === "assistant_text" && event.text) process.stdout.write(event.text);
      else if (event.type === "status" && event.message) {
        console.error(`[wath] ${event.message}`);
      }
    };

    let orphanIntegrateBranch: string | undefined;
    if (phase === "integrate" && standardId && agentTarget.mode === "cloud") {
      orphanIntegrateBranch =
        freshBeforeLaunch.integrations[standardId]?.work_branch ??
        (await discoverIntegrateBranch(agentTarget.repoUrl).catch(() => undefined));
      if (orphanIntegrateBranch) {
        const entry = state.integrations[standardId];
        if (entry && entry.work_branch !== orphanIntegrateBranch) {
          entry.work_branch = orphanIntegrateBranch;
          entry.status = "pending";
          appendHistory(state, "integrate_branch_reused", orphanIntegrateBranch);
          persistState();
        }
        console.error(
          `[wath] orphan integrate branch ${orphanIntegrateBranch} — validate-only, skipping new integrate agent`
        );
      }
    }

    if (phase === "integrate" && standardId && !orphanIntegrateBranch) {
      if (driftRemediation) {
        await notifyProgress(
          options,
          appId,
          validatingProgress(standardId, { branch: "main" }),
          state,
          persistState
        );
      } else {
        await notifyProgress(options, appId, integratingProgress(standardId), state, persistState);
      }
    } else if (phase === "validate" && standardId) {
      const branch =
        (loadApplicationState(repoRoot, appId) ?? state).integrations[standardId]?.work_branch ??
        undefined;
      await notifyProgress(
        options,
        appId,
        validatingProgress(standardId, branch ? { branch } : undefined),
        state,
        persistState
      );
    }

    const useSingleSessionChain =
      phase === "integrate" &&
      options.launch &&
      options.throughValidate !== false &&
      !options._chainValidate &&
      agentTarget.mode === "cloud" &&
      Boolean(standardId) &&
      !orphanIntegrateBranch &&
      !driftRemediation;

    const useDriftVerifyOnMain =
      driftRemediation &&
      phase === "integrate" &&
      options.launch &&
      !orphanIntegrateBranch &&
      agentTarget.mode === "cloud" &&
      Boolean(standardId);

    if (orphanIntegrateBranch && phase === "integrate" && standardId && options.launch) {
      await notifyProgress(
        options,
        appId,
        validatingProgress(standardId, { branch: orphanIntegrateBranch }),
        state,
        persistState
      );
      const prRetries = maxPrRetries(options);
      const validatePrompt = buildValidatePrompt(context, standardId, orphanIntegrateBranch, {
        ...(driftRemediation ? { driftRemediation } : {}),
      });

      const agentResult = await launchValidateWithPrRetries({
        apiKey,
        validatePrompt,
        retryPrompt: (attempt, workBranch) =>
          buildCreatePrRetryPrompt(
            context,
            standardId,
            workBranch ?? orphanIntegrateBranch,
            attempt,
            driftRemediation ? { driftRemediation } : {}
          ),
        workBranch: orphanIntegrateBranch,
        startingRef: orphanIntegrateBranch,
        maxPrRetries: prRetries,
        config,
        target: agentTarget,
        onEvent: onAgentEvent,
        onPrRetry: (attempt) => {
          console.error(
            `[wath] PR not detected after validate (attempt ${attempt}/${prRetries - 1}), retrying…`
          );
        },
      });

      result.agent = agentResult;
      const finalized = await applyValidateFinalize({
        appId,
        standardId,
        repoUrl: resolvedConsumer.repo,
        driftRemediation,
        agentResult,
        workBranch: orphanIntegrateBranch,
        state,
        prRetries,
        options,
      });
      result.state = finalized.state;
      return finishTrackedRun(appId, options, result);
    }

    if (useDriftVerifyOnMain) {
      console.error("[wath] drift verify on main — skipping integrate agent");
      const validatePrompt = buildValidatePrompt(context, standardId!, "main", {
        driftRemediation,
        verifyOnMain: true,
      });

      const prRetries = maxPrRetries(options);
      const agentResult = await launchOnboardingAgent({
        apiKey,
        prompt: validatePrompt,
        config,
        autoCreatePR: false,
        startingRef: "main",
        target: agentTarget,
        onEvent: onAgentEvent,
      });

      result.agent = agentResult;
      const finalized = await applyValidateFinalize({
        appId,
        standardId: standardId!,
        repoUrl: resolvedConsumer.repo,
        driftRemediation,
        agentResult,
        workBranch: "main",
        state,
        prRetries,
        options,
      });
      result.state = finalized.state;
      return finishTrackedRun(appId, options, result);
    }

    if (useSingleSessionChain) {
      const validatePrompt = buildValidatePrompt(context, standardId!, undefined, {
        sameAgentSession: true,
        ...(driftRemediation ? { driftRemediation } : {}),
      });

      const prRetries = maxPrRetries(options);
      const chain = await launchIntegrateValidateChain({
        apiKey,
        integratePrompt: prompt,
        validatePrompt,
        retryPrompt: (attempt, workBranch) =>
          buildCreatePrRetryPrompt(
            context,
            standardId!,
            workBranch ?? "cursor/<integration-branch>",
            attempt,
            driftRemediation ? { driftRemediation } : {}
          ),
        maxPrRetries: prRetries,
        config,
        target: agentTarget,
        onEvent: onAgentEvent,
        onValidateStart: async (integrate) => {
          const branch =
            integrate.branch ?? (await resolveIntegrateBranch(resolvedConsumer.repo, integrate));
          await notifyProgress(
            options,
            appId,
            validatingProgress(standardId!, branch ? { branch } : undefined),
            state,
            persistState
          );
        },
        onPrRetry: (attempt) => {
          console.error(
            `[wath] PR not detected after validate (attempt ${attempt}/${prRetries - 1}), retrying…`
          );
        },
      });

      result.integrateAgent = chain.integrate;
      result.agent = chain.validate;

      const branch = await resolveIntegrateBranch(resolvedConsumer.repo, chain.integrate);
      if (standardId && state.integrations[standardId]) {
        persistIntegrateOutcome(state, standardId, chain.integrate, branch);
      }
      appendHistory(state, "integrate_complete", standardId);

      const finalized = await applyValidateFinalize({
        appId,
        standardId: standardId!,
        repoUrl: resolvedConsumer.repo,
        driftRemediation,
        agentResult: chain.validate,
        workBranch: branch ?? undefined,
        state,
        prRetries,
        options,
      });
      result.state = finalized.state;

      return finishTrackedRun(appId, options, result);
    }

    let validateBranch =
      phase === "validate" && standardId
        ? (loadApplicationState(repoRoot, appId) ?? state).integrations[standardId]?.work_branch ??
          undefined
        : undefined;
    if (phase === "validate" && !validateBranch && agentTarget.mode === "cloud") {
      validateBranch = await discoverIntegrateBranch(agentTarget.repoUrl);
    }
    const resumeAgentId =
      options._resumeAgentId ??
      (phase === "validate" && standardId
        ? (loadApplicationState(repoRoot, appId) ?? state).integrations[standardId]
            ?.integrate_agent_id ?? undefined
        : undefined);

    const prRetries = maxPrRetries(options);
    const agentResult =
      phase === "validate" && agentTarget.mode === "cloud"
        ? await launchValidateWithPrRetries({
            apiKey,
            validatePrompt: prompt,
            retryPrompt: (attempt, workBranch) =>
              buildCreatePrRetryPrompt(
                context,
                standardId!,
                workBranch ?? validateBranch ?? "cursor/<integration-branch>",
                attempt,
                driftRemediation ? { driftRemediation } : {}
              ),
            workBranch: validateBranch,
            maxPrRetries: prRetries,
            config,
            resumeAgentId,
            ...(validateBranch ? { startingRef: validateBranch } : {}),
            target: agentTarget,
            onEvent: onAgentEvent,
            onPrRetry: (attempt) => {
              console.error(
                `[wath] PR not detected after validate (attempt ${attempt}/${prRetries - 1}), retrying…`
              );
            },
          })
        : await launchOnboardingAgent({
            apiKey,
            prompt,
            config,
            autoCreatePR: phase === "validate" || phase === "enrich_manifest",
            ...(resumeAgentId
              ? { resumeAgentId }
              : validateBranch
                ? { startingRef: validateBranch }
                : {}),
            target: agentTarget,
            onEvent: onAgentEvent,
          });

    result.agent = agentResult;

    if (phase === "enrich_manifest" && agentResult.prUrl) {
      recordAgentPr(appId, "manifest", agentResult.prUrl);
      result.state = loadApplicationState(repoRoot, appId)!;
    } else if (phase === "validate" && standardId) {
      const finalized = await applyValidateFinalize({
        appId,
        standardId,
        repoUrl: resolvedConsumer.repo,
        driftRemediation,
        agentResult,
        workBranch: validateBranch,
        state,
        prRetries,
        options,
      });
      result.state = finalized.state;
    } else if (phase === "integrate") {
      if (standardId && state.integrations[standardId]) {
        state.integrations[standardId].integrate_agent_id = agentResult.agentId;
        const branch = await resolveIntegrateBranch(resolvedConsumer.repo, agentResult);
        if (branch) {
          state.integrations[standardId].work_branch = branch;
          appendHistory(state, "integrate_branch", branch);
        }
        appendHistory(state, "integrate_agent", agentResult.agentId);
      }
      state.phase = "validate";
      appendHistory(state, "integrate_complete", standardId);
      persistState();
      result.state = state;
    }

    return finishTrackedRun(appId, options, result);
  } catch (err) {
    if (options.trackProgress !== false) {
      const message = err instanceof Error ? err.message : String(err);
      failActiveRun(appId, message);
    }
    throw err;
  } finally {
    if (ownsLock) releaseOnboardLock(appId);
  }
}

export function getLifecycleStatus(
  consumerPathOrAppId: string,
  wathPathOption?: string
): {
  appId: string;
  state: ApplicationState | null;
  spec?: ReturnType<typeof parseWathSpec>;
  activeRun: ActiveRunStatusView | null;
} {
  const repoRoot = resolveRepoRoot();

  if (consumerPathOrAppId.includes("github.com")) {
    const appId = resolveApplicationId(consumerPathOrAppId);
    return {
      appId,
      state: loadApplicationState(repoRoot, appId),
      activeRun: toActiveRunStatusView(loadActiveRun(appId, repoRoot)),
    };
  }

  if (/^[^/]+\/[^/]+$/.test(consumerPathOrAppId)) {
    return {
      appId: consumerPathOrAppId,
      state: loadApplicationState(repoRoot, consumerPathOrAppId),
      activeRun: toActiveRunStatusView(loadActiveRun(consumerPathOrAppId, repoRoot)),
    };
  }

  const intent: OnboardingIntent = {
    consumerRepoPath: consumerPathOrAppId,
    ...(wathPathOption ? { wathPath: wathPathOption } : {}),
  };
  const wathPath = resolveWathPath(intent);
  const spec = parseWathSpec(wathPath);
  const appId = resolveApplicationId(spec.repo);
  return {
    appId,
    state: loadApplicationState(repoRoot, appId),
    spec,
    activeRun: toActiveRunStatusView(loadActiveRun(appId, repoRoot)),
  };
}

export function recordMerge(input: RecordMergeInput): ApplicationState {
  return doRecordMerge(input);
}

export function audit(options: { apply?: boolean; wathRoot?: string } = {}): AuditReport {
  if (options.apply) return applyAuditToState(options.wathRoot);
  return runComplianceAudit(options.wathRoot);
}

export { resolveApplicationId, loadApplicationState, saveApplicationState } from "./state.js";
