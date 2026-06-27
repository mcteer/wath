import { join } from "node:path";

import type { WathIntegrationsSpec } from "../requirements/parser.js";
import type { ResolvedStandard } from "../types.js";
import { resolveOnboardingConfig } from "../onboarding/artifacts.js";

/**
 * Generate .cursor/environment.json from WATCH_INTEGRATIONS stack + standard sandbox config.
 */
export function generateEnvironmentConfig(
  _spec: WathIntegrationsSpec,
  standard: ResolvedStandard
): Record<string, unknown> {
  const onboarding = resolveOnboardingConfig(standard);
  if (!onboarding.sandbox) {
    return { install: "", start: "", terminals: [] };
  }

  const base = join("standards", standard.entry.path);
  return {
    install: `bash ${join(base, onboarding.sandbox.install)}`,
    start: `bash ${join(base, onboarding.sandbox.start)}`,
    terminals: [],
  };
}
