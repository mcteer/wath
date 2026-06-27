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

/** Consumer-repo `.cursor/mcp.json` — Wath only. Cloud Agents get auxiliary MCP via wath-core at launch. */
export function buildConsumerMcpJson(
  config: WathConfig,
  consumerRepoUrl?: string
): {
  mcpServers: Record<string, { url: string; headers?: Record<string, string> }>;
} {
  const url = config.wathMcpUrl ?? "http://127.0.0.1:8080/mcp";
  const headers: Record<string, string> = {};
  const token = process.env.WATH_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    headers.Authorization = "Bearer dev-local-token";
  }
  if (consumerRepoUrl) {
    headers["X-Wath-Consumer-Repo"] = consumerRepoUrl;
  }

  return {
    mcpServers: {
      wath: { url, headers },
    },
  };
}
