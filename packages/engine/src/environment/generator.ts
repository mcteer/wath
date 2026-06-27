import type { RequirementsSlices } from "../requirements/parser.js";

/**
 * Generate .cursor/environment.json from requirements environment slice.
 */
export function generateEnvironmentConfig(
  _requirements: RequirementsSlices,
  _standardId: string
): Record<string, unknown> {
  return {
    install:
      "bash standards/security/vault-dynamic-secrets/conformance/install-sandbox-deps.sh",
    start: "bash standards/security/vault-dynamic-secrets/conformance/start-sandbox.sh",
    terminals: [],
  };
}
