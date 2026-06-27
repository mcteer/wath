/**
 * Stateful MCP Streamable HTTP handlers (POST + GET SSE + DELETE).
 * Cursor and other HTTP MCP clients require session-scoped transports.
 */
import { randomUUID } from "node:crypto";

import type { Express, Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { createWathMcpServer } from "./mcp-server.js";
import { runWithRequestContext } from "./request-context.js";

const transports: Record<string, StreamableHTTPServerTransport> = {};

function jsonRpcError(res: Response, status: number, message: string): void {
  res.status(status).json({
    jsonrpc: "2.0",
    error: { code: -32000, message },
    id: null,
  });
}

async function mcpPostHandler(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport | undefined;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const newSessionId = randomUUID();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        enableJsonResponse: true,
        onsessioninitialized: (sid) => {
          transports[sid] = transport!;
        },
      });
      // Register before handleRequest so a fast client GET cannot miss the session.
      transports[newSessionId] = transport;

      transport.onclose = () => {
        const sid = transport?.sessionId;
        if (sid && transports[sid]) {
          delete transports[sid];
        }
      };

      const server = createWathMcpServer();
      await server.connect(transport);
      await runWithRequestContext({ headers: req.headers }, () =>
        transport!.handleRequest(req, res, req.body)
      );
      return;
    } else {
      jsonRpcError(res, 400, "Bad Request: No valid session ID provided");
      return;
    }

    await runWithRequestContext({ headers: req.headers }, () =>
      transport!.handleRequest(req, res, req.body)
    );
  } catch (err) {
    console.error("[wath] MCP POST failed:", err);
    if (!res.headersSent) {
      jsonRpcError(res, 500, "Internal server error");
    }
  }
}

async function mcpGetHandler(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId) {
    // Optional pre-init SSE probe — MCP clients treat 405 as "not available yet".
    res.status(405).set("Allow", "GET, POST, DELETE").send("Method Not Allowed");
    return;
  }
  if (!transports[sessionId]) {
    res.status(404).send("Session not found");
    return;
  }

  try {
    await transports[sessionId].handleRequest(req, res);
  } catch (err) {
    console.error("[wath] MCP GET (SSE) failed:", err);
    if (!res.headersSent) {
      res.status(500).send("MCP SSE error");
    }
  }
}

async function mcpDeleteHandler(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(404).send("Session not found");
    return;
  }

  try {
    await transports[sessionId].handleRequest(req, res);
  } catch (err) {
    console.error("[wath] MCP DELETE failed:", err);
    if (!res.headersSent) {
      res.status(500).send("Session termination error");
    }
  }
}

/** Register MCP Streamable HTTP routes on an Express app. */
export function registerMcpHttpRoutes(
  app: Express,
  mcpPath: string,
  authorize: (authHeader: string | undefined) => boolean
): void {
  const guard =
    (handler: (req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response): Promise<void> => {
      if (!authorize(req.headers.authorization)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      await handler(req, res);
    };

  app.post(mcpPath, guard(mcpPostHandler));
  app.get(mcpPath, guard(mcpGetHandler));
  app.delete(mcpPath, guard(mcpDeleteHandler));
}
