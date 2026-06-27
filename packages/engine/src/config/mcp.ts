import type { McpServerConfig } from "@cursor/sdk";
import type { WathConfig } from "./env.js";

/** MCP servers passed inline to cloud/local agents (HTTP transport). */
export function buildMcpServers(config: WathConfig): Record<string, McpServerConfig> {
  const servers: Record<string, McpServerConfig> = {};

  if (config.hashicorpDocsMcpUrl) {
    servers["hashicorp-docs"] = {
      type: "http",
      url: config.hashicorpDocsMcpUrl,
    };
  }

  if (config.internalDocsMcpUrl) {
    servers["internal-docs"] = {
      type: "http",
      url: config.internalDocsMcpUrl,
      headers: process.env.WATH_MCP_INTERNAL_DOCS_TOKEN
        ? { Authorization: `Bearer ${process.env.WATH_MCP_INTERNAL_DOCS_TOKEN}` }
        : undefined,
    };
  }

  if (config.wathMcpUrl) {
    servers.wath = {
      type: "http",
      url: config.wathMcpUrl,
      headers: process.env.WATH_TOKEN
        ? { Authorization: `Bearer ${process.env.WATH_TOKEN}` }
        : undefined,
    };
  }

  return servers;
}

/** Consumer-repo `.cursor/mcp.json` shape for materialization. */
export function buildConsumerMcpJson(config: WathConfig): {
  mcpServers: Record<string, { url: string; headers?: Record<string, string> }>;
} {
  const inline = buildMcpServers(config);
  const mcpServers: Record<string, { url: string; headers?: Record<string, string> }> = {};

  for (const [name, server] of Object.entries(inline)) {
    if ("url" in server && server.url) {
      mcpServers[name] = {
        url: server.url,
        ...(server.headers ? { headers: server.headers } : {}),
      };
    }
  }

  return { mcpServers };
}
