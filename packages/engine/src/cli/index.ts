#!/usr/bin/env node
import { listStandards, resolveRepoRoot, resolveStandard } from "../standards/registry.js";
import { runOnboarding } from "../onboarding/pipeline.js";
import { runConformanceGate } from "../verify/runner.js";

const [, , command, ...args] = process.argv;

function usage(): void {
  console.log(`Wath — onboarding & conformance engine

Usage:
  wath list                          List registered standards
  wath show <standard-id>            Show standard metadata
  wath onboard <consumer-repo-path>  Compose onboarding context (demo)
  wath verify <standard-id> <artifact-root>  Run conformance gate

Environment:
  WATH_ROOT   Path to Wath repo root (auto-detected if unset)
`);
}

async function main(): Promise<void> {
  const repoRoot = resolveRepoRoot();

  switch (command) {
    case "list": {
      const standards = listStandards(repoRoot);
      for (const s of standards) {
        console.log(`${s.id} (v${s.version}) — ${s.owner} — runtimes: ${s.runtimes.join(", ")}`);
      }
      break;
    }
    case "show": {
      const id = args[0];
      if (!id) {
        console.error("Usage: wath show <standard-id>");
        process.exit(1);
      }
      const standard = resolveStandard(repoRoot, id);
      console.log(JSON.stringify({ entry: standard.entry, metadata: standard.metadata }, null, 2));
      break;
    }
    case "onboard": {
      const consumerPath = args[0];
      if (!consumerPath) {
        console.error("Usage: wath onboard <consumer-repo-path>");
        process.exit(1);
      }
      const context = await runOnboarding({
        consumerRepoPath: consumerPath,
        ...(args[1] ? { standardId: args[1] } : {}),
      });
      console.log(JSON.stringify(context, null, 2));
      break;
    }
    case "verify": {
      const [standardId, artifactRoot] = args;
      if (!standardId || !artifactRoot) {
        console.error("Usage: wath verify <standard-id> <artifact-root>");
        process.exit(1);
      }
      const standard = resolveStandard(repoRoot, standardId);
      const result = runConformanceGate(standard, artifactRoot);
      console.log(result.output);
      process.exit(result.passed ? 0 : 1);
    }
    default:
      usage();
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
