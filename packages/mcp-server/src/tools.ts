import type { LifecycleProgressUpdate, OnboardingPhase } from "@wath/engine";
import {
  audit,
  getLifecycleStatus,
  recordMerge,
  resolveConsumer,
  runLifecycle,
} from "@wath/engine";

import { getConsumerRepoHeader } from "./request-context.js";

export const WATH_TOOL_DEFINITIONS = [
  {
    name: "wath.onboard",
    description:
      "Onboard this app to Wath. Read wath.json and pass repo (the repo field). Chains integrate+validate via Cloud Agents and opens an integration PR. Emits MCP progress notifications (integrating → validating → PR submitted) when the client supports them. Example: { \"repo\": \"https://github.com/org/app\" }",
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
      },
    },
  },
  {
    name: "wath.status",
    description:
      "Return onboarding lifecycle state. Read wath.json and pass repo (the repo field).",
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

export interface WathToolContext {
  onProgress?: (update: LifecycleProgressUpdate) => void | Promise<void>;
}

function repoFromArgs(args: Record<string, unknown>): string | undefined {
  if (args.repo) return String(args.repo);
  if (args.target) return String(args.target);
  if (args.repoUrl) return String(args.repoUrl);
  return getConsumerRepoHeader();
}

/** Execute a Wath MCP tool; returns JSON-serializable result or throws. */
export async function executeWathTool(
  name: string,
  args: Record<string, unknown>,
  context?: WathToolContext
): Promise<unknown> {
  switch (name) {
    case "wath.onboard": {
      const launch = args.launch !== false;
      const consumerPath = args.consumerPath ? String(args.consumerPath) : undefined;
      const repo = repoFromArgs(args);
      return runLifecycle(
        {
          ...(consumerPath ? { consumerRepoPath: consumerPath } : {}),
          ...(args.wathPath ? { wathPath: String(args.wathPath) } : {}),
          ...(args.standardId ? { standardId: String(args.standardId) } : {}),
        },
        {
          launch,
          dryRun: !launch,
          materialize: args.materialize === true,
          ...(args.phase ? { phase: args.phase as OnboardingPhase } : {}),
          ...(repo ? { repo, target: repo } : {}),
          ...(args.throughValidate === false ? { throughValidate: false } : {}),
          consumerRepoHeader: getConsumerRepoHeader(),
          ...(context?.onProgress ? { onProgress: context.onProgress } : {}),
        }
      );
    }
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
    case "wath.audit":
      return audit({ apply: Boolean(args.apply) });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
