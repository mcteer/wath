import type { OnboardingPhase } from "@wath/engine";
import {
  audit,
  getLifecycleStatus,
  recordMerge,
  resolveConsumerRepoPath,
  runLifecycle,
} from "@wath/engine";

export const WATH_TOOL_DEFINITIONS = [
  {
    name: "wath.onboard",
    description:
      "Onboard an app to Wath (wath.json). Call with no arguments to run the sole mounted consumer through integrate+validate and open an integration PR via Cloud Agents.",
    inputSchema: {
      type: "object",
      properties: {
        consumerPath: {
          type: "string",
          description:
            "Optional. Consumer path relative to WATH_ROOT. Omitted when only one consumer is mounted.",
        },
        target: {
          type: "string",
          description: "Optional. Repo URL, org/repo app id, or consumer path when multiple apps exist.",
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
        repoUrl: { type: "string", description: "Override GitHub repo URL for cloud agent" },
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
      "Return onboarding lifecycle state. Omit target when only one consumer is mounted.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Optional. Consumer path, repo URL, or org/repo application id.",
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

/** Execute a Wath MCP tool; returns JSON-serializable result or throws. */
export async function executeWathTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "wath.onboard": {
      const launch = args.launch !== false;
      const consumerPath = args.consumerPath ? String(args.consumerPath) : undefined;
      const target = args.target ? String(args.target) : undefined;
      const repoUrl = args.repoUrl ? String(args.repoUrl) : undefined;
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
          ...(repoUrl ? { repoUrl } : {}),
          ...(target ? { target } : {}),
          ...(args.throughValidate === false ? { throughValidate: false } : {}),
        }
      );
    }
    case "wath.status": {
      const target = args.target ? String(args.target) : undefined;
      if (target) {
        return getLifecycleStatus(target, args.wathPath ? String(args.wathPath) : undefined);
      }
      const resolved = resolveConsumerRepoPath({});
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
