#!/usr/bin/env node
/** Wath CLI — list standards, dry-run/launch onboarding, run conformance gates. */
import { listStandards, resolveRepoRoot, resolveStandard } from "../standards/registry.js";
import { runOnboarding } from "../onboarding/pipeline.js";
import { runConformanceGate } from "../verify/runner.js";

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

function usage(): void {
  console.log(`Wath — onboarding & conformance engine

Usage:
  wath list                              List registered standards
  wath show <standard-id>                Show standard metadata
  wath onboard <consumer-path> [opts]    Compose or launch onboarding
  wath verify <standard-id> <artifact-root>  Run conformance gate

Onboard options:
  --launch              Launch Cursor cloud/local agent (requires CURSOR_API_KEY)
  --local               Use local agent runtime (default: cloud)
  --dry-run             Compose context + prompt only (default without --launch)
  --materialize         Write .cursor config into consumer repo
  --force-materialize   Overwrite existing .cursor files
  --repo-url <url>      GitHub repo URL for cloud agent
  --standard-id <id>    Standard ID (optional; inferred from runtime)
  --wath-path <path>          Alternate wath.json path
  --integrations-path <path>  Alias for --wath-path (deprecated)
  --requirements-path <path>  Alias for --wath-path (deprecated)

Environment:
  CURSOR_API_KEY              Cursor API key (required for --launch)
  WATH_ROOT                   Path to Wath repo root
  WATH_CONSUMER_REPO_URL      GitHub URL for cloud onboarding
  WATH_MODEL                  Model id (default: composer-2.5)
  WATH_MCP_HASHICORP_DOCS_URL HashiCorp docs MCP URL
  WATH_MCP_INTERNAL_DOCS_URL  Internal platform docs MCP URL
  WATH_MCP_URL                Wath MCP server URL
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
      const id = argv[0];
      if (!id) {
        console.error("Usage: wath show <standard-id>");
        process.exit(1);
      }
      const standard = resolveStandard(repoRoot, id);
      console.log(JSON.stringify({ entry: standard.entry, metadata: standard.metadata }, null, 2));
      break;
    }
    case "onboard": {
      const { flags, positional, options } = parseArgs(argv);
      const consumerPath = positional[0];
      if (!consumerPath) {
        console.error("Usage: wath onboard <consumer-path> [--launch] [--local] ...");
        process.exit(1);
      }

      const launch = flags.has("--launch");
      const result = await runOnboarding(
        {
          consumerRepoPath: consumerPath,
          ...(options["standard-id"] ? { standardId: options["standard-id"] } : {}),
          ...(options["wath-path"] ||
          options["integrations-path"] ||
          options["requirements-path"]
            ? {
                wathPath:
                  options["wath-path"] ??
                  options["integrations-path"] ??
                  options["requirements-path"],
              }
            : {}),
        },
        {
          launch,
          dryRun: flags.has("--dry-run") || !launch,
          local: flags.has("--local"),
          materialize: flags.has("--materialize") || launch,
          forceMaterialize: flags.has("--force-materialize"),
          repoUrl: options["repo-url"],
        }
      );

      if (launch) {
        console.error("\n[wath] onboarding complete");
        console.log(JSON.stringify(result.agent ?? { status: "no agent result" }, null, 2));
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
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
