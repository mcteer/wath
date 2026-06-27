import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { buildConsumerMcpJson } from "../config/mcp.js";
import type { WathConfig } from "../config/env.js";
import { generateEnvironmentConfig } from "../environment/generator.js";
import type { OnboardingContext } from "./pipeline.js";
import { parseIntegrationsSpec } from "../requirements/parser.js";
import { prTemplateRepoPath } from "./artifacts.js";

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

  // Standard-scoped agent rule (e.g. vault-dynamic-secrets.mdc)
  const ruleName =
    context.standard.metadata.onboarding?.consumer_rule ??
    context.standard.entry.id;
  const standardRuleSrc = join(
    templateRoot,
    `.cursor/rules/standards/${ruleName}.mdc`
  );
  if (existsSync(standardRuleSrc)) {
    copyIfNeeded(
      standardRuleSrc,
      join(standardsRulesDir, `${ruleName}.mdc`)
    );
  }

  const prTemplateRel = prTemplateRepoPath(context.standard);
  const prTemplateSrc = join(templateRoot, prTemplateRel);
  const prTemplateDest = join(consumerRoot, prTemplateRel);
  mkdirSync(join(consumerRoot, ".github/PULL_REQUEST_TEMPLATE"), {
    recursive: true,
  });
  if (existsSync(prTemplateSrc)) {
    copyIfNeeded(prTemplateSrc, prTemplateDest);
  }

  const spec = parseIntegrationsSpec(context.integrationsPath);
  const environmentJson = generateEnvironmentConfig(spec, context.standard);
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

  // Copy SKILL into consumer-visible path for the cloud agent
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

/** Extract repository URL from WATCH_INTEGRATIONS.json or config. */
export function resolveConsumerRepoUrl(
  context: OnboardingContext,
  config: WathConfig
): string {
  if (config.consumerRepoUrl) {
    return config.consumerRepoUrl;
  }
  const spec = parseIntegrationsSpec(context.integrationsPath);
  if (spec.repo.startsWith("http")) {
    return spec.repo;
  }
  throw new Error(
    "Repository URL required for cloud onboarding. Set WATH_CONSUMER_REPO_URL or fill repo in WATCH_INTEGRATIONS.json"
  );
}
