#!/usr/bin/env node
/** Wath CLI — standards, lifecycle onboarding, verification, compliance audit. */
import { listStandards, resolveRepoRoot, resolveStandard } from "../standards/registry.js";
import { runOnboarding } from "../onboarding/pipeline.js";
import { runConformanceGate } from "../verify/runner.js";
import {
  audit,
  getLifecycleStatus,
  recordMerge,
  runLifecycle,
} from "../lifecycle/orchestrator.js";
import type { OnboardingPhase } from "../lifecycle/types.js";

const [, , command, ...argv] = process.argv;

interface ParsedArgs {
  flags: Set<string>;
  positional: string[];
  options: Record<string, string>;
}

function parseArgs(args: string[]): ParsedArgs {
  const flags = new Set<string>();
  const positional: string[] = [];
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        options[key] = next;
        i++;
      } else {
        flags.add(arg);
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional, options };
}

function lifecycleIntentFromOptions(
  consumerPath: string | undefined,
  options: Record<string, string>
) {
  return {
    ...(consumerPath ? { consumerRepoPath: consumerPath } : {}),
    ...(options["standard-id"] ? { standardId: options["standard-id"] } : {}),
    ...(options["wath-path"] || options["integrations-path"] || options["requirements-path"]
      ? {
          wathPath:
            options["wath-path"] ??
            options["integrations-path"] ??
            options["requirements-path"],
        }
      : {}),
  };
}

function usage(): void {
  console.log(`Wath — onboarding & conformance engine

Usage:
  wath list                              List registered standards
  wath show <standard-id>                Show standard metadata
  wath onboard <consumer-path> [opts]    Legacy single-shot onboarding
  wath lifecycle <consumer-path> [opts]  Multi-phase lifecycle (manifest → integrate → validate)
  wath status <path|repo-url|org/repo>   Lifecycle state for an application
  wath record-merge [opts]               Record a merged PR and advance phase
  wath audit [--apply] [--json]          Compliance audit vs standards registry
  wath verify <standard-id> <artifact-root>  Run conformance gate

Lifecycle / onboard options:
  --launch              Launch Cursor cloud/local agent (requires CURSOR_API_KEY)
  --local               Use local agent runtime (default: cloud)
  --dry-run             Compose context + prompt only (default without --launch)
  --materialize         Write .cursor config into consumer repo
  --force-materialize   Overwrite existing .cursor files
  --repo-url <url>      GitHub repo URL for cloud agent
  --standard-id <id>    Standard ID for integrate/validate phase
  --phase <phase>       Force phase (discover, enrich_manifest, integrate, validate, ...)
  --wath-path <path>    Alternate wath.json path

record-merge options:
  --app <org/repo>      Application id (required)
  --type manifest|integration
  --pr <url>            Merged PR URL
  --standard <id>       Required for integration merges

Environment:
  CURSOR_API_KEY              Cursor API key (required for --launch)
  WATH_ROOT                   Path to Wath repo root
  WATH_CONSUMER_REPO_URL      GitHub URL for cloud onboarding
  WATH_MODEL                  Model id (default: composer-2.5)
`);
}

async function runLifecycleCommand(
  argv: string[],
  legacyOnboard = false
): Promise<void> {
  const { flags, positional, options } = parseArgs(argv);
  const consumerPath = positional[0];

  const launch = flags.has("--launch");

  if (legacyOnboard && !flags.has("--lifecycle")) {
    const result = await runOnboarding(lifecycleIntentFromOptions(consumerPath, options), {
      launch,
      dryRun: flags.has("--dry-run") || !launch,
      local: flags.has("--local"),
      materialize: flags.has("--materialize"),
      forceMaterialize: flags.has("--force-materialize"),
      repoUrl: options["repo-url"],
    });
    if (launch) {
      console.error("\n[wath] onboarding complete");
      console.log(JSON.stringify(result.agent ?? { status: "no agent result" }, null, 2));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  const result = await runLifecycle(lifecycleIntentFromOptions(consumerPath, options), {
    launch,
    dryRun: flags.has("--dry-run") || !launch,
    local: flags.has("--local"),
    materialize: flags.has("--materialize"),
    forceMaterialize: flags.has("--force-materialize"),
    repoUrl: options["repo-url"],
    ...(options.phase ? { phase: options.phase as OnboardingPhase } : {}),
  });

  if (launch) {
    console.error(`\n[wath] lifecycle phase=${result.phase} app=${result.appId}`);
    console.log(JSON.stringify(result.agent ?? { phase: result.phase }, null, 2));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
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
      const id = argv[0];
      if (!id) {
        console.error("Usage: wath show <standard-id>");
        process.exit(1);
      }
      const standard = resolveStandard(repoRoot, id);
      console.log(JSON.stringify({ entry: standard.entry, metadata: standard.metadata }, null, 2));
      break;
    }
    case "onboard":
      await runLifecycleCommand(argv, true);
      break;
    case "lifecycle":
      await runLifecycleCommand(argv, false);
      break;
    case "status": {
      const { flags, positional, options } = parseArgs(argv);
      const target = positional[0];
      if (!target) {
        console.error("Usage: wath status <consumer-path|repo-url|org/repo>");
        process.exit(1);
      }
      const status = getLifecycleStatus(
        target,
        options["wath-path"] ?? options["integrations-path"]
      );
      console.log(JSON.stringify(status, null, 2));
      break;
    }
    case "record-merge": {
      const { options } = parseArgs(argv);
      const appId = options.app;
      const type = options.type as "manifest" | "integration" | undefined;
      if (!appId || !type) {
        console.error("Usage: wath record-merge --app org/repo --type manifest|integration [--pr URL] [--standard ID]");
        process.exit(1);
      }
      const state = recordMerge({
        appId,
        type,
        ...(options.pr ? { prUrl: options.pr } : {}),
        ...(options.standard ? { standardId: options.standard } : {}),
      });
      console.log(JSON.stringify(state, null, 2));
      break;
    }
    case "audit": {
      const { flags } = parseArgs(argv);
      const report = audit({ apply: flags.has("--apply") });
      console.log(JSON.stringify(report, null, 2));
      break;
    }
    case "verify": {
      const [standardId, artifactRoot] = argv;
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
