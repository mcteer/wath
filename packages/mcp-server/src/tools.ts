import type { OnboardingPhase } from "@wath/engine";
import {
  audit,
  getLifecycleStatus,
  recordMerge,
  runLifecycle,
} from "@wath/engine";

export const WATH_TOOL_DEFINITIONS = [
  {
    name: "wath.onboard",
    description:
      "Start or resume multi-phase Wath onboarding for an app repo (wath.json). Dry-run by default; set launch=true to run Cursor agents.",
    inputSchema: {
      type: "object",
      properties: {
        consumerPath: {
          type: "string",
          description: "Path to consumer repo relative to WATH_ROOT or absolute",
        },
        wathPath: { type: "string", description: "Alternate path to wath.json" },
        launch: { type: "boolean", description: "Launch Cursor cloud agent" },
        materialize: { type: "boolean", description: "Write .cursor config into consumer repo" },
        phase: {
          type: "string",
          description: "Force phase: discover, enrich_manifest, integrate, validate, await_merge",
        },
        standardId: { type: "string", description: "Standard ID for integrate/validate" },
        repoUrl: { type: "string", description: "Override GitHub repo URL for cloud agent" },
      },
      required: ["consumerPath"],
    },
  },
  {
    name: "wath.status",
    description: "Return onboarding lifecycle state for an app (path, repo URL, or org/repo id).",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Consumer path, repo URL, or org/repo application id",
        },
        wathPath: { type: "string" },
      },
      required: ["target"],
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
      const consumerPath = String(args.consumerPath ?? "");
      const launch = Boolean(args.launch);
      return runLifecycle(
        {
          consumerRepoPath: consumerPath,
          ...(args.wathPath ? { wathPath: String(args.wathPath) } : {}),
          ...(args.standardId ? { standardId: String(args.standardId) } : {}),
        },
        {
          launch,
          dryRun: !launch,
          materialize: args.materialize !== false && (launch || Boolean(args.materialize)),
          ...(args.phase ? { phase: args.phase as OnboardingPhase } : {}),
          ...(args.repoUrl ? { repoUrl: String(args.repoUrl) } : {}),
        }
      );
    }
    case "wath.status":
      return getLifecycleStatus(
        String(args.target ?? ""),
        args.wathPath ? String(args.wathPath) : undefined
      );
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
