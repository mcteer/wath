import type { Response } from "express";

/** Format one Server-Sent Events frame (event name + JSON payload). */
export function formatSseEvent(event: string, data: unknown): string {
  const payload = JSON.stringify(data);
  const lines = payload.split("\n").map((line) => `data: ${line}`);
  return `event: ${event}\n${lines.join("\n")}\n\n`;
}

export interface SseWriter {
  write(event: string, data: unknown): void;
  writeError(message: string): void;
  end(): void;
}

/** Attach SSE headers and return a writer that ignores output after the response closes. */
export function createSseWriter(res: Response): SseWriter {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const write = (event: string, data: unknown): void => {
    if (res.writableEnded) return;
    res.write(formatSseEvent(event, data));
  };

  return {
    write,
    writeError(message: string): void {
      write("error", { error: message });
      if (!res.writableEnded) res.end();
    },
    end(): void {
      if (!res.writableEnded) res.end();
    },
  };
}
