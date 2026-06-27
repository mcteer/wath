#!/usr/bin/env node
/**
 * Wath core HTTP server — REST API + MCP Streamable HTTP for container deployment.
 */
import type { Request, Response } from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createWathMcpServer } from "./mcp-server.js";
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
      const result = await executeWathTool("wath.onboard", (req.body ?? {}) as Record<string, unknown>);
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
      const result = await executeWathTool("wath.status", {
        target,
        ...(wathPath ? { wathPath } : {}),
      });
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

  // MCP Streamable HTTP (stateless — one transport per request)
  app.post(MCP_PATH, async (req: Request, res: Response) => {
    if (!authorize(req.headers.authorization)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const server = createWathMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("[wath] MCP request failed:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "MCP internal error" });
      }
    }
  });

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
