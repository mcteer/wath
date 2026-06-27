import type { RequirementsSlices } from "../requirements/parser.js";

/**
 * Generate .cursor/environment.json from requirements environment slice.
 * Phase 3/4: install Vault + throwaway Postgres in the sandbox VM.
 */
export function generateEnvironmentConfig(
  _requirements: RequirementsSlices,
  _standardId: string
): Record<string, unknown> {
  return {
    snapshot: "POPULATED_FROM_REQUIREMENTS",
    install: "vault, postgres, pytest, python-hcl2, jsonschema, pyyaml",
    start: "vault server -dev & postgres ...",
  };
}
