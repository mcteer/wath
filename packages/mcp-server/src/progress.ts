import type { LifecycleProgressUpdate } from "@wath/engine";

export interface OnboardProgressExtra {
  _meta?: { progressToken?: string | number };
  sendNotification?: (notification: {
    method: "notifications/progress";
    params: {
      progressToken: string | number;
      progress: number;
      total: number;
      message: string;
    };
  }) => Promise<void>;
}

/** Send MCP notifications/progress when the client supplied a progressToken. */
export function createOnboardProgressReporter(
  extra: OnboardProgressExtra | undefined
): ((update: LifecycleProgressUpdate) => Promise<void>) | undefined {
  const token = extra?._meta?.progressToken;
  if (token === undefined || !extra?.sendNotification) return undefined;

  let lastProgress = 0;
  return async (update: LifecycleProgressUpdate): Promise<void> => {
    const progress =
      update.progress > lastProgress ? update.progress : lastProgress + 0.01;
    lastProgress = progress;
    await extra.sendNotification!({
      method: "notifications/progress",
      params: {
        progressToken: token,
        progress,
        total: update.total,
        message: update.message,
      },
    });
  };
}
