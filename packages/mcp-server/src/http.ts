#!/usr/bin/env node
/**
 * Wath core HTTP server — REST API + MCP Streamable HTTP for container deployment.
 */
import type { Request, Response } from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";

import { registerMcpHttpRoutes } from "./mcp-http-handlers.js";
import { runWithRequestContext } from "./request-context.js";
import { executeWathTool } from "./tools.js";

const PORT = Number(process.env.PORT ?? process.env.WATH_PORT ?? 8080);
const HOST = process.env.WATH_HOST ?? "0.0.0.0";
const MCP_PATH = process.env.WATH_MCP_PATH ?? "/mcp";

function readBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

function authorize(authHeader: string | undefined): boolean {
  const expected = process.env.WATH_TOKEN?.trim();
  if (!expected) return true;
  return readBearerToken(authHeader) === expected;
}

async function main(): Promise<void> {
  const app = createMcpExpressApp({ host: HOST });

  app.use((req: Request, _res: Response, next) => {
    if (req.path === MCP_PATH) {
      console.error(
        `[wath] MCP ${req.method} auth=${req.headers.authorization ? "present" : "missing"} origin=${req.headers.origin ?? "-"}`
      );
    }
    next();
  });

  // Remote MCP clients (Cursor Desktop, cloud agents) use cross-origin fetch.
  // Expose session headers and allow Private Network Access to localhost dev hosts.
  app.use((req: Request, res: Response, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version, Last-Event-ID, X-Wath-Consumer-Repo"
    );
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "wath-core",
      wathRoot: process.env.WATH_ROOT ?? process.cwd(),
    });
  });

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).send("ok");
  });

  app.post("/api/v1/lifecycle", async (req: Request, res: Response) => {
    if (!authorize(req.headers.authorization)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const result = await runWithRequestContext({ headers: req.headers }, () =>
        executeWathTool("wath.onboard", (req.body ?? {}) as Record<string, unknown>)
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/v1/status", async (req: Request, res: Response) => {
    if (!authorize(req.headers.authorization)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const target = String(req.query.target ?? "");
      const wathPath = req.query.wathPath ? String(req.query.wathPath) : undefined;
      const result = await runWithRequestContext({ headers: req.headers }, () =>
        executeWathTool("wath.status", {
          target,
          ...(wathPath ? { wathPath } : {}),
        })
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/v1/record-merge", async (req: Request, res: Response) => {
    if (!authorize(req.headers.authorization)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const result = await executeWathTool("wath.record_merge", (req.body ?? {}) as Record<string, unknown>);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/v1/audit", async (req: Request, res: Response) => {
    if (!authorize(req.headers.authorization)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const apply = req.query.apply === "true" || req.query.apply === "1";
      const result = await executeWathTool("wath.audit", { apply });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // MCP Streamable HTTP — stateful sessions (POST initialize + GET SSE + DELETE)
  registerMcpHttpRoutes(app, MCP_PATH, authorize);

  app.listen(PORT, HOST, () => {
    console.error(`[wath] core listening on http://${HOST}:${PORT}`);
    console.error(`[wath] REST /api/v1/*  MCP ${MCP_PATH}  health /health`);
    console.error(`[wath] WATH_ROOT=${process.env.WATH_ROOT ?? process.cwd()}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
