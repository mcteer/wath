import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import type {
  ResolvedStandard,
  StandardMetadata,
  StandardRegistry,
  StandardRegistryEntry,
} from "../types.js";

export function resolveStandardsRoot(repoRoot: string): string {
  return join(repoRoot, "standards");
}

export function loadRegistry(repoRoot: string): StandardRegistry {
  const registryPath = join(resolveStandardsRoot(repoRoot), "registry.yaml");
  if (!existsSync(registryPath)) {
    throw new Error(`Standards registry not found: ${registryPath}`);
  }
  const raw = readFileSync(registryPath, "utf8");
  return parseYaml(raw) as StandardRegistry;
}

export function loadStandardMetadata(
  standardsRoot: string,
  entry: StandardRegistryEntry
): StandardMetadata {
  const metadataPath = join(standardsRoot, entry.path, "standard.yaml");
  if (!existsSync(metadataPath)) {
    throw new Error(`Standard metadata not found: ${metadataPath}`);
  }
  const raw = readFileSync(metadataPath, "utf8");
  return parseYaml(raw) as StandardMetadata;
}

export function resolveStandard(
  repoRoot: string,
  standardId: string
): ResolvedStandard {
  const standardsRoot = resolveStandardsRoot(repoRoot);
  const registry = loadRegistry(repoRoot);
  const entry = registry.standards.find((s) => s.id === standardId);
  if (!entry) {
    const available = registry.standards.map((s) => s.id).join(", ");
    throw new Error(
      `Standard "${standardId}" not found in registry. Available: ${available}`
    );
  }

  const rootPath = join(standardsRoot, entry.path);
  const metadata = loadStandardMetadata(standardsRoot, entry);

  return {
    entry,
    metadata,
    rootPath,
    skillPath: join(rootPath, "SKILL.md"),
    schemaPath: join(rootPath, metadata.schema),
    conformancePath: join(rootPath, metadata.conformance_entry),
  };
}

export function listStandards(repoRoot: string): StandardRegistryEntry[] {
  return loadRegistry(repoRoot).standards;
}

export function findStandardsForRuntime(
  repoRoot: string,
  runtime: string
): StandardRegistryEntry[] {
  return loadRegistry(repoRoot).standards.filter((s) =>
    s.runtimes.includes(runtime)
  );
}

export function resolveRepoRoot(cwd = process.cwd()): string {
  if (process.env.WATH_ROOT) {
    return resolve(process.env.WATH_ROOT);
  }
  let dir = resolve(cwd);
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "standards", "registry.yaml"))) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return cwd;
}
