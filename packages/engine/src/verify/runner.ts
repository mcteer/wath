import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

import type { ResolvedStandard, VerifyResult } from "../types.js";

/**
 * Invoke a standard's conformance/verify.sh against a consumer artifact root.
 * This is the generic verification mechanism — each standard ships its own gate.
 */
export function runConformanceGate(
  standard: ResolvedStandard,
  artifactRoot: string,
  options: { behavioral?: boolean } = {}
): VerifyResult {
  const verifyScript = standard.conformancePath;
  if (!existsSync(verifyScript)) {
    throw new Error(`Conformance entry not found: ${verifyScript}`);
  }

  const env = {
    ...process.env,
    WATH_ARTIFACT_ROOT: artifactRoot,
    WATH_BEHAVIORAL: options.behavioral ? "1" : "0",
  };

  try {
    const output = execSync(`bash "${verifyScript}"`, {
      cwd: artifactRoot,
      env,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return {
      standardId: standard.entry.id,
      passed: true,
      output,
    };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    const output = [error.stdout, error.stderr, error.message]
      .filter(Boolean)
      .join("\n");
    return {
      standardId: standard.entry.id,
      passed: false,
      output,
    };
  }
}
