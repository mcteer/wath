import type { LifecycleProgressUpdate, OnboardingPhase } from "@wath/engine";
import {
  audit,
  beginActiveRun,
  getLifecycleStatus,
  loadActiveRun,
  pollMergedPrs,
  pollDrift,
  recordMerge,
  resolveApplicationId,
  resolveConsumer,
  runLifecycle,
} from "@wath/engine";

import { getConsumerRepoHeader } from "./request-context.js";

export const WATH_TOOL_DEFINITIONS = [
  {
    name: "wath.onboard",
    description:
      "Onboard this app to Wath. Read wath.json and pass repo (the repo field). Returns immediately (async default) — poll wath.status for activeRun progress until done. Chains integrate+validate via Cloud Agents and opens an integration PR. Example: { \"repo\": \"https://github.com/org/app\", \"launch\": true }",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "The repo field from wath.json.",
        },
        consumerPath: {
          type: "string",
          description:
            "Optional. Local consumer checkout under WATH_ROOT (verify/materialize only).",
        },
        target: {
          type: "string",
          description: "Deprecated — use repo (from wath.json).",
        },
        wathPath: { type: "string", description: "Alternate path to wath.json" },
        launch: {
          type: "boolean",
          description: "Launch Cloud Agents (default: true). Set false for dry-run prompt only.",
        },
        materialize: {
          type: "boolean",
          description: "Write .cursor scaffolding into the consumer repo (default: false).",
        },
        phase: {
          type: "string",
          description: "Force phase: discover, enrich_manifest, integrate, validate, await_merge",
        },
        standardId: { type: "string", description: "Standard ID for integrate/validate" },
        repoUrl: { type: "string", description: "Deprecated — use repo (from wath.json)." },
        throughValidate: {
          type: "boolean",
          description:
            "When launch=true, run validate after integrate in the same call (default: true).",
        },
        async: {
          type: "boolean",
          description:
            "When launch=true, return immediately and run in background (default: true). Poll wath.status for activeRun. Set false to block until complete.",
        },
      },
    },
  },
  {
    name: "wath.status",
    description:
      "Return onboarding lifecycle state and activeRun progress (stage, message) while onboarding is in flight. Read wath.json and pass repo (the repo field).",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "The repo field from wath.json.",
        },
        target: {
          type: "string",
          description: "Deprecated — use repo (from wath.json).",
        },
        wathPath: { type: "string" },
      },
    },
  },
  {
    name: "wath.record_merge",
    description: "Record that a manifest or integration PR was merged; advances lifecycle phase.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "Application id org/repo" },
        type: { type: "string", enum: ["manifest", "integration"] },
        prUrl: { type: "string" },
        standardId: { type: "string", description: "Required when type is integration" },
      },
      required: ["appId", "type"],
    },
  },
  {
    name: "wath.poll_merges",
    description:
      "Poll GitHub for merged onboarding PRs and update application state (same as wath-core background merge poller).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "wath.poll_drift",
    description:
      "Run compliance audit, apply drift flags, and launch onboard for apps behind the current standard version (same as wath-core background drift poller).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "wath.audit",
    description:
      "Run compliance audit vs standards registry; optionally apply drift flags to state files.",
    inputSchema: {
      type: "object",
      properties: {
        apply: { type: "boolean", description: "Write drift flags to state files" },
      },
    },
  },
] as const;

export type WathToolName = (typeof WATH_TOOL_DEFINITIONS)[number]["name"];

/** Cursor and some agents call tools with underscores instead of dots. */
const MCP_TOOL_ALIASES: Record<string, WathToolName> = {
  wath_onboard: "wath.onboard",
  "wath-onboard": "wath.onboard",
  wath_status: "wath.status",
  "wath-status": "wath.status",
  wath_record_merge: "wath.record_merge",
  "wath-record-merge": "wath.record_merge",
  wath_poll_merges: "wath.poll_merges",
  "wath-poll-merges": "wath.poll_merges",
  wath_poll_drift: "wath.poll_drift",
  "wath-poll-drift": "wath.poll_drift",
  wath_audit: "wath.audit",
  "wath-audit": "wath.audit",
};

export function resolveMcpToolName(name: string): string {
  return MCP_TOOL_ALIASES[name] ?? name;
}

/** Cursor displays and calls tools with underscores; expose those names in ListTools. */
type McpToolDefinition = (typeof WATH_TOOL_DEFINITIONS)[number];

export function listMcpToolDefinitions(): McpToolDefinition[] {
  return WATH_TOOL_DEFINITIONS.map((tool) => ({
    ...tool,
    name: tool.name.replace(/\./g, "_"),
  })) as McpToolDefinition[];
}

export interface WathToolContext {
  onProgress?: (update: LifecycleProgressUpdate) => void | Promise<void>;
}

function repoFromArgs(args: Record<string, unknown>): string | undefined {
  if (args.repo) return String(args.repo);
  if (args.target) return String(args.target);
  if (args.repoUrl) return String(args.repoUrl);
  return getConsumerRepoHeader();
}


function buildOnboardIntent(args: Record<string, unknown>) {
  const consumerPath = args.consumerPath ? String(args.consumerPath) : undefined;
  return {
    ...(consumerPath ? { consumerRepoPath: consumerPath } : {}),
    ...(args.wathPath ? { wathPath: String(args.wathPath) } : {}),
    ...(args.standardId ? { standardId: String(args.standardId) } : {}),
  };
}

function buildOnboardOptions(
  args: Record<string, unknown>,
  context?: WathToolContext
) {
  const launch = args.launch !== false;
  const repo = repoFromArgs(args);
  return {
    launch,
    dryRun: !launch,
    materialize: args.materialize === true,
    trackProgress: launch,
    ...(args.phase ? { phase: args.phase as OnboardingPhase } : {}),
    ...(repo ? { repo, target: repo } : {}),
    ...(args.throughValidate === false ? { throughValidate: false } : {}),
    consumerRepoHeader: getConsumerRepoHeader(),
    ...(context?.onProgress ? { onProgress: context.onProgress } : {}),
  };
}

async function resolveOnboardAppId(args: Record<string, unknown>): Promise<string> {
  const repo = repoFromArgs(args);
  if (repo) return resolveApplicationId(repo);
  const resolved = await resolveConsumer({
    consumerRepoHeader: getConsumerRepoHeader(),
    ...(args.consumerPath ? { consumerRepoPath: String(args.consumerPath) } : {}),
  });
  return resolved.appId;
}

async function executeOnboard(
  args: Record<string, unknown>,
  context?: WathToolContext
): Promise<unknown> {
  const launch = args.launch !== false;
  const intent = buildOnboardIntent(args);
  const options = buildOnboardOptions(args, context);

  if (!launch || args.async === false) {
    return runLifecycle(intent, options);
  }

  const appId = await resolveOnboardAppId(args);
  const active = loadActiveRun(appId);
  if (active?.status === "running") {
    return {
      async: true,
      appId,
      activeRun: active,
      skipped: true,
      skipReason: "onboard_in_progress",
    };
  }

  beginActiveRun(appId);
  void runLifecycle(intent, options).catch((err: unknown) => {
    console.error(`[wath] async onboard failed for ${appId}:`, err);
  });

  return {
    async: true,
    appId,
    activeRun: loadActiveRun(appId),
    message:
      "Onboarding started. Poll wath.status every 15–30 seconds and relay activeRun.message to the user until activeRun.status is done or error.",
  };
}


/** Execute a Wath MCP tool; returns JSON-serializable result or throws. */
export async function executeWathTool(
  name: string,
  args: Record<string, unknown>,
  context?: WathToolContext
): Promise<unknown> {
  switch (resolveMcpToolName(name)) {
    case "wath.onboard":
      return executeOnboard(args, context);
    case "wath.status": {
      const repo = repoFromArgs(args);
      if (repo) {
        return getLifecycleStatus(repo, args.wathPath ? String(args.wathPath) : undefined);
      }
      const resolved = await resolveConsumer({
        consumerRepoHeader: getConsumerRepoHeader(),
      });
      return getLifecycleStatus(resolved.repo, args.wathPath ? String(args.wathPath) : undefined);
    }
    case "wath.record_merge":
      return recordMerge({
        appId: String(args.appId),
        type: args.type as "manifest" | "integration",
        ...(args.prUrl ? { prUrl: String(args.prUrl) } : {}),
        ...(args.standardId ? { standardId: String(args.standardId) } : {}),
      });
    case "wath.poll_merges":
      return pollMergedPrs();
    case "wath.poll_drift":
      return pollDrift();
    case "wath.audit":
      return audit({ apply: Boolean(args.apply) });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
