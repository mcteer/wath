import { pollDrift, type PollDriftResult } from "@wath/engine";

const DEFAULT_INTERVAL_MS = 60_000;

function cursorApiKeyConfigured(): boolean {
  return Boolean(process.env.CURSOR_API_KEY?.trim());
}

function readIntervalMs(): number {
  const raw = process.env.WATH_DRIFT_POLL_INTERVAL_MS?.trim();
  if (!raw) return DEFAULT_INTERVAL_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 60_000) return DEFAULT_INTERVAL_MS;
  return n;
}

/** Background loop: detect standard version drift and launch remediation onboard runs. */
export function startDriftPoller(): { stop: () => void } {
  if (process.env.WATH_DRIFT_POLL_ENABLED === "0") {
    console.error("[wath] drift poller disabled (WATH_DRIFT_POLL_ENABLED=0)");
    return { stop: () => undefined };
  }

  if (!cursorApiKeyConfigured()) {
    console.error(
      "[wath] drift poller disabled — set CURSOR_API_KEY in deploy/.env for automatic drift remediation"
    );
    return { stop: () => undefined };
  }

  const intervalMs = readIntervalMs();
  let running = false;

  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const result: PollDriftResult = await pollDrift();
      for (const entry of result.triggered) {
        const detail = entry.drift
          .map((d) => `${d.standardId} v${d.recordedVersion}→v${d.currentVersion}`)
          .join(", ");
        console.error(`[wath] drift poller triggered onboard: ${entry.appId} (${detail})`);
      }
      for (const skip of result.skipped) {
        if (skip.reason !== "launch_disabled") {
          console.error(`[wath] drift poller skipped ${skip.appId}: ${skip.reason}`);
        }
      }
      for (const err of result.errors) {
        console.error(`[wath] drift poller error (${err.appId}): ${err.message}`);
      }
    } catch (err) {
      console.error(
        `[wath] drift poller tick failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      running = false;
    }
  };

  console.error(`[wath] drift poller started (every ${intervalMs}ms)`);
  void tick();
  const handle = setInterval(() => {
    void tick();
  }, intervalMs);

  return {
    stop: () => clearInterval(handle),
  };
}
