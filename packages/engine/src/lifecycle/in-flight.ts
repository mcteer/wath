/** In-memory lock: one active launch per application id (single wath-core process). */

export interface OnboardLockSnapshot {
  phase: string;
  since: string;
}

const active = new Map<string, OnboardLockSnapshot>();

export function tryAcquireOnboardLock(
  appId: string,
  phase: string
): { acquired: true } | { acquired: false; active: OnboardLockSnapshot } {
  const existing = active.get(appId);
  if (existing) return { acquired: false, active: existing };
  active.set(appId, { phase, since: new Date().toISOString() });
  return { acquired: true };
}

export function releaseOnboardLock(appId: string): void {
  active.delete(appId);
}

/** @internal Test helper */
export function clearOnboardLocks(): void {
  active.clear();
}
