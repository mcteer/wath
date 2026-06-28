import type { Request, Response } from "express";

import { runWithRequestContext } from "./request-context.js";
import { createSseWriter } from "./sse.js";
import { executeWathTool } from "./tools.js";

function lifecycleArgs(body: unknown): Record<string, unknown> {
  return (body ?? {}) as Record<string, unknown>;
}

/** POST /api/v1/lifecycle — blocking JSON response. */
export async function handleLifecycleJson(req: Request, res: Response): Promise<void> {
  try {
    const result = await runWithRequestContext({ headers: req.headers }, () =>
      executeWathTool("wath.onboard", { ...lifecycleArgs(req.body), async: false })
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

/** POST /api/v1/lifecycle/stream — SSE progress + final result. */
export async function handleLifecycleStream(req: Request, res: Response): Promise<void> {
  const sse = createSseWriter(res);
  const args = lifecycleArgs(req.body);

  sse.write("started", {
    tool: "wath.onboard",
    repo: args.repo ?? args.target ?? args.repoUrl ?? null,
    launch: args.launch !== false,
  });

  try {
    const result = await runWithRequestContext({ headers: req.headers }, () =>
      executeWathTool("wath.onboard", { ...args, async: false }, {
        onProgress: async (update) => {
          sse.write("progress", update);
        },
      })
    );
    sse.write("done", result);
    sse.end();
  } catch (err) {
    sse.writeError(err instanceof Error ? err.message : String(err));
  }
}
