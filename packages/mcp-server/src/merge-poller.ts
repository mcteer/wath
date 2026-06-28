import { pollMergedPrs, type PollMergeResult } from "@wath/engine";

const DEFAULT_INTERVAL_MS = 30_000;

function githubTokenConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim());
}

function readIntervalMs(): number {
  const raw = process.env.WATH_MERGE_POLL_INTERVAL_MS?.trim();
  if (!raw) return DEFAULT_INTERVAL_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 5_000) return DEFAULT_INTERVAL_MS;
  return n;
}

/** Background loop: detect merged onboarding PRs and update application state. */
export function startMergePoller(): { stop: () => void } {
  if (process.env.WATH_MERGE_POLL_ENABLED === "0") {
    console.error("[wath] merge poller disabled (WATH_MERGE_POLL_ENABLED=0)");
    return { stop: () => undefined };
  }

  if (!githubTokenConfigured()) {
    console.error(
      "[wath] merge poller disabled — set GITHUB_TOKEN (or GH_TOKEN) in deploy/.env (required for GitHub API rate limits)"
    );
    return { stop: () => undefined };
  }

  const intervalMs = readIntervalMs();
  let running = false;

  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const result: PollMergeResult = await pollMergedPrs();
      for (const entry of result.recorded) {
        console.error(
          `[wath] merge poller recorded ${entry.type} merge: ${entry.appId} ${entry.prUrl}`
        );
      }
      for (const err of result.errors) {
        console.error(`[wath] merge poller error (${err.appId} ${err.prUrl}): ${err.message}`);
      }
    } catch (err) {
      console.error(
        `[wath] merge poller tick failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      running = false;
    }
  };

  console.error(`[wath] merge poller started (every ${intervalMs}ms)`);
  void tick();
  const handle = setInterval(() => {
    void tick();
  }, intervalMs);

  return {
    stop: () => clearInterval(handle),
  };
}
