import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import type {
  ResolvedStandard,
  StandardMetadata,
  StandardRegistry,
  StandardRegistryEntry,
} from "../types.js";

/** Resolve the standards registry root relative to the repo. */
export function resolveStandardsRoot(repoRoot: string): string {
  return join(repoRoot, "standards");
}

/** Load and parse standards/registry.yaml. */
export function loadRegistry(repoRoot: string): StandardRegistry {
  const registryPath = join(resolveStandardsRoot(repoRoot), "registry.yaml");
  if (!existsSync(registryPath)) {
    throw new Error(`Standards registry not found: ${registryPath}`);
  }
  const raw = readFileSync(registryPath, "utf8");
  return parseYaml(raw) as StandardRegistry;
}

/** Load standard.yaml metadata for a registry entry. */
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

/** Resolve a standard by ID from the registry. */
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

/** List all standards registered in the marketplace catalog. */
export function listStandards(repoRoot: string): StandardRegistryEntry[] {
  return loadRegistry(repoRoot).standards;
}

/** Find standards applicable to a given runtime (e.g. kubernetes). */
export function findStandardsForRuntime(
  repoRoot: string,
  runtime: string
): StandardRegistryEntry[] {
  return loadRegistry(repoRoot).standards.filter((s) =>
    s.runtimes.includes(runtime)
  );
}

/** Resolve the Wath repo root from cwd or WATH_ROOT env. */
export function resolveRepoRoot(cwd = process.cwd()): string {
  if (process.env.WATH_ROOT) {
    return resolve(process.env.WATH_ROOT);
  }
  // Walk up looking for standards/registry.yaml
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
