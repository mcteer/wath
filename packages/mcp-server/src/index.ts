#!/usr/bin/env node
/**
 * Wath MCP server — stdio transport for Cursor Desktop (local dev).
 * For container deployment use dist/http.js instead.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createWathMcpServer } from "./mcp-server.js";

async function main(): Promise<void> {
  const server = createWathMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
