#!/usr/bin/env node
/**
 * Write minimal .cursor/mcp.json (Wath only) with headers synced from wath.json repo.
 * Usage: node scripts/sync-consumer-mcp.js <consumer-repo-path> [wath-mcp-url]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const target = process.argv[2];
const mcpUrl = process.argv[3] ?? "http://127.0.0.1:8080/mcp";
const authToken = process.env.WATH_TOKEN?.trim() || "dev-local-token";

if (!target) {
  console.error("Usage: node scripts/sync-consumer-mcp.js <consumer-repo-path> [wath-mcp-url]");
  process.exit(1);
}

const wathJsonPath = join(target, "wath.json");
const mcpPath = join(target, ".cursor", "mcp.json");

if (!existsSync(wathJsonPath)) {
  console.error(`wath.json not found: ${wathJsonPath}`);
  process.exit(1);
}

let repo;
try {
  const doc = JSON.parse(readFileSync(wathJsonPath, "utf8"));
  if (typeof doc.repo !== "string" || !doc.repo.startsWith("http")) {
    throw new Error('wath.json "repo" must be an http(s) URL');
  }
  repo = doc.repo.replace(/\.git$/, "").replace(/\/$/, "");
} catch (err) {
  console.error(`Invalid wath.json: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

const mcp = {
  mcpServers: {
    wath: {
      url: mcpUrl,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "X-Wath-Consumer-Repo": repo,
      },
    },
  },
};

mkdirSync(join(target, ".cursor"), { recursive: true });
writeFileSync(mcpPath, JSON.stringify(mcp, null, 2) + "\n");
console.error(`Wrote ${mcpPath} (wath only, repo=${repo})`);
