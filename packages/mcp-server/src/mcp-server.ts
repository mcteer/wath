import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { WATH_TOOL_DEFINITIONS, executeWathTool, type WathToolContext } from "./tools.js";
import { createOnboardProgressReporter } from "./progress.js";

/** Create MCP Server with Wath lifecycle tools registered. */
export function createWathMcpServer(): Server {
  const server = new Server(
    { name: "wath", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: WATH_TOOL_DEFINITIONS.map((t) => ({ ...t })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    const a = (args ?? {}) as Record<string, unknown>;
    const reporter = createOnboardProgressReporter(extra);
    const context: WathToolContext | undefined = reporter
      ? {
          onProgress: async (update) => {
            await reporter(update);
          },
        }
      : undefined;
    try {
      const result = await executeWathTool(name, a, context);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  });

  return server;
}
