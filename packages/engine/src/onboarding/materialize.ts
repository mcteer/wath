import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { buildConsumerMcpJson } from "../config/mcp.js";
import type { WathConfig } from "../config/env.js";
import { generateEnvironmentConfig } from "../environment/generator.js";
import type { OnboardingContext } from "./pipeline.js";
import { parseRequirements } from "../requirements/parser.js";

export interface MaterializeResult {
  consumerRoot: string;
  filesWritten: string[];
}

/** Resolve absolute consumer app root within the Wath repo or external path. */
export function resolveConsumerRoot(
  wathRoot: string,
  consumerRepoPath: string
): string {
  return resolve(wathRoot, consumerRepoPath);
}

/**
 * Materialize consumer `.cursor` config from Wath templates + generated environment.
 * Skips files that already exist unless force=true.
 */
export function materializeConsumerConfig(
  context: OnboardingContext,
  config: WathConfig,
  options: { force?: boolean } = {}
): MaterializeResult {
  const wathRoot = context.repoRoot;
  const consumerRoot = resolveConsumerRoot(wathRoot, context.consumerRepoPath);
  const templateRoot = join(wathRoot, "templates/consumer");
  const filesWritten: string[] = [];

  if (!existsSync(consumerRoot)) {
    throw new Error(`Consumer path does not exist: ${consumerRoot}`);
  }

  const cursorDir = join(consumerRoot, ".cursor");
  const rulesDir = join(cursorDir, "rules");
  const standardsRulesDir = join(rulesDir, "standards");
  mkdirSync(standardsRulesDir, { recursive: true });

  const copyIfNeeded = (src: string, dest: string) => {
    if (existsSync(dest) && !options.force) return;
    cpSync(src, dest);
    filesWritten.push(dest);
  };

  copyIfNeeded(
    join(templateRoot, ".cursor/rules/wath-overview.mdc"),
    join(rulesDir, "wath-overview.mdc")
  );
  copyIfNeeded(
    join(templateRoot, ".cursor/rules/wath-agent-process.mdc"),
    join(rulesDir, "wath-agent-process.mdc")
  );
  copyIfNeeded(
    join(templateRoot, ".cursor/rules/standards/vault-dynamic-secrets.mdc"),
    join(standardsRulesDir, "vault-dynamic-secrets.mdc")
  );

  const requirements = parseRequirements(context.requirementsPath);
  const environmentJson = generateEnvironmentConfig(
    requirements,
    context.standard.entry.id
  );
  const envPath = join(cursorDir, "environment.json");
  if (!existsSync(envPath) || options.force) {
    writeFileSync(envPath, JSON.stringify(environmentJson, null, 2) + "\n");
    filesWritten.push(envPath);
  }

  const mcpPath = join(cursorDir, "mcp.json");
  if (!existsSync(mcpPath) || options.force) {
    writeFileSync(mcpPath, JSON.stringify(buildConsumerMcpJson(config), null, 2) + "\n");
    filesWritten.push(mcpPath);
  }

  // Symlink or copy standard SKILL into consumer-visible path for cloud agent
  const skillLink = join(cursorDir, "skills");
  mkdirSync(skillLink, { recursive: true });
  const skillSrc = context.standard.skillPath;
  const skillDest = join(skillLink, `${context.standard.entry.id}.md`);
  if (!existsSync(skillDest) || options.force) {
    writeFileSync(skillDest, readFileSync(skillSrc, "utf8"));
    filesWritten.push(skillDest);
  }

  return { consumerRoot, filesWritten };
}

/** Extract repository URL from requirements or config. */
export function resolveConsumerRepoUrl(
  context: OnboardingContext,
  config: WathConfig
): string {
  if (config.consumerRepoUrl) {
    return config.consumerRepoUrl;
  }
  const requirements = parseRequirements(context.requirementsPath);
  const fromDoc = requirements.environment["Repository"]?.replace(/[`<>]/g, "").trim();
  if (fromDoc && fromDoc.startsWith("http")) {
    return fromDoc;
  }
  throw new Error(
    "Repository URL required for cloud onboarding. Set WATH_CONSUMER_REPO_URL or fill Repository in INTEGRATION_REQUIREMENTS.md"
  );
}
