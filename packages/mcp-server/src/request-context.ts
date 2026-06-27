import { AsyncLocalStorage } from "node:async_hooks";

export interface WathRequestContext {
  headers: Record<string, string | string[] | undefined>;
}

const storage = new AsyncLocalStorage<WathRequestContext>();

export function runWithRequestContext<T>(ctx: WathRequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestHeaders(): Record<string, string | string[] | undefined> {
  return storage.getStore()?.headers ?? {};
}

/** Repo URL from X-Wath-Consumer-Repo — set by the consumer app's .cursor/mcp.json. */
export function getConsumerRepoHeader(): string | undefined {
  const headers = getRequestHeaders();
  const value = headers["x-wath-consumer-repo"] ?? headers["X-Wath-Consumer-Repo"];
  return Array.isArray(value) ? value[0]?.trim() : value?.trim();
}
