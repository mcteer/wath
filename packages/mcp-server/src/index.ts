#!/usr/bin/env node
/**
 * Wath MCP server — stdio transport exposing lifecycle tools for Cursor Desktop.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  audit,
  getLifecycleStatus,
  recordMerge,
  runLifecycle,
} from "@wath/engine";

const server = new Server(
  { name: "wath", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
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
            description:
              "Force phase: discover, enrich_manifest, integrate, validate, await_merge",
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
      description: "Run compliance audit vs standards registry; optionally apply drift flags to state files.",
      inputSchema: {
        type: "object",
        properties: {
          apply: { type: "boolean", description: "Write drift flags to state files" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    if (name === "wath.onboard") {
      const consumerPath = String(a.consumerPath ?? "");
      const launch = Boolean(a.launch);
      const result = await runLifecycle(
        {
          consumerRepoPath: consumerPath,
          ...(a.wathPath ? { wathPath: String(a.wathPath) } : {}),
          ...(a.standardId ? { standardId: String(a.standardId) } : {}),
        },
        {
          launch,
          dryRun: !launch,
          materialize: a.materialize !== false && (launch || Boolean(a.materialize)),
          ...(a.phase ? { phase: a.phase as import("@wath/engine").OnboardingPhase } : {}),
          ...(a.repoUrl ? { repoUrl: String(a.repoUrl) } : {}),
        }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "wath.status") {
      const target = String(a.target ?? "");
      const status = getLifecycleStatus(
        target,
        a.wathPath ? String(a.wathPath) : undefined
      );
      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    }

    if (name === "wath.record_merge") {
      const state = recordMerge({
        appId: String(a.appId),
        type: a.type as "manifest" | "integration",
        ...(a.prUrl ? { prUrl: String(a.prUrl) } : {}),
        ...(a.standardId ? { standardId: String(a.standardId) } : {}),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(state, null, 2) }],
      };
    }

    if (name === "wath.audit") {
      const report = audit({ apply: Boolean(a.apply) });
      return {
        content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
