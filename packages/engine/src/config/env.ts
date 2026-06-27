/** Wath engine configuration from environment. */

export interface WathConfig {
  apiKey: string | undefined;
  model: string;
  consumerRepoUrl: string | undefined;
  hashicorpDocsMcpUrl: string | undefined;
  internalDocsMcpUrl: string | undefined;
  wathMcpUrl: string | undefined;
}

export function loadConfig(): WathConfig {
  return {
    apiKey: process.env.CURSOR_API_KEY?.trim() || undefined,
    model: process.env.WATH_MODEL?.trim() || "composer-2.5",
    consumerRepoUrl: process.env.WATH_CONSUMER_REPO_URL?.trim() || undefined,
    hashicorpDocsMcpUrl:
      process.env.WATH_MCP_HASHICORP_DOCS_URL?.trim() ||
      "https://developer.hashicorp.com/api/mcp",
    internalDocsMcpUrl: process.env.WATH_MCP_INTERNAL_DOCS_URL?.trim(),
    wathMcpUrl: process.env.WATH_MCP_URL?.trim(),
  };
}

export function requireApiKey(config: WathConfig): string {
  if (!config.apiKey) {
    throw new Error(
      "CURSOR_API_KEY is required to launch an agent. Set it or use --dry-run."
    );
  }
  return config.apiKey;
}
