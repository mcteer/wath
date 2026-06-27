import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { parseWathSpec } from "../requirements/parser.js";
import { resolveRepoRoot } from "../standards/registry.js";
import { resolveApplicationId } from "../lifecycle/state.js";

export interface ResolveConsumerInput {
  consumerRepoPath?: string;
  /** Repo URL, org/repo app id, or consumer path relative to WATH_ROOT. */
  target?: string;
  repoUrl?: string;
}

export interface ResolvedConsumer {
  consumerRepoPath: string;
  repo: string;
  appId: string;
}

function normalizeRepoUrl(url: string): string {
  return url.replace(/\.git$/, "").replace(/\/$/, "").toLowerCase();
}

function isAppId(value: string): boolean {
  return /^[^/]+\/[^/]+$/.test(value) && !value.includes("github.com");
}

function searchRoots(wathRoot: string): string[] {
  const configured = process.env.WATH_CONSUMER_SEARCH_PATHS?.trim();
  const relRoots = configured
    ? configured.split(",").map((s) => s.trim()).filter(Boolean)
    : ["consumers"];
  return relRoots.map((r) => join(wathRoot, r)).filter((p) => existsSync(p));
}

function discoverConsumers(wathRoot: string): ResolvedConsumer[] {
  const found: ResolvedConsumer[] = [];

  for (const root of searchRoots(wathRoot)) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const consumerRoot = join(root, entry.name);
      const wathJson = join(consumerRoot, "wath.json");
      if (!existsSync(wathJson)) continue;

      try {
        const spec = parseWathSpec(wathJson);
        const consumerRepoPath = relative(wathRoot, consumerRoot);
        found.push({
          consumerRepoPath,
          repo: spec.repo,
          appId: resolveApplicationId(spec.repo),
        });
      } catch {
        // skip invalid consumer trees
      }
    }
  }

  return found.sort((a, b) => a.consumerRepoPath.localeCompare(b.consumerRepoPath));
}

function resolveExistingPath(wathRoot: string, path: string): ResolvedConsumer | null {
  const consumerRepoPath = path;
  const wathJson = join(wathRoot, consumerRepoPath, "wath.json");
  if (!existsSync(wathJson)) return null;
  const spec = parseWathSpec(wathJson);
  return {
    consumerRepoPath,
    repo: spec.repo,
    appId: resolveApplicationId(spec.repo),
  };
}

function matchTarget(candidates: ResolvedConsumer[], target: string): ResolvedConsumer | undefined {
  const normalizedTarget = normalizeRepoUrl(target);
  return candidates.find(
    (c) =>
      c.consumerRepoPath === target ||
      c.appId === target ||
      normalizeRepoUrl(c.repo) === normalizedTarget ||
      (isAppId(target) && c.appId === target)
  );
}

/**
 * Resolve which consumer repo to onboard when the caller omits consumerPath.
 * Prefers explicit paths, then repo/app id, then WATH_DEFAULT_CONSUMER_PATH,
 * then the sole discovered consumer under consumers/ and examples/.
 */
export function resolveConsumerRepoPath(
  input: ResolveConsumerInput = {},
  wathRoot?: string
): ResolvedConsumer {
  const root = wathRoot ?? resolveRepoRoot();

  if (input.consumerRepoPath?.trim()) {
    const resolved = resolveExistingPath(root, input.consumerRepoPath.trim());
    if (!resolved) {
      throw new Error(
        `Consumer path has no wath.json: ${input.consumerRepoPath}`
      );
    }
    return resolved;
  }

  const target = (input.target ?? input.repoUrl)?.trim();
  if (target) {
    const asPath = resolveExistingPath(root, target);
    if (asPath) return asPath;

    const candidates = discoverConsumers(root);
    const matched = matchTarget(candidates, target);
    if (matched) return matched;

    throw new Error(
      `No consumer found for target "${target}". Known: ${candidates.map((c) => c.appId).join(", ") || "(none)"}`
    );
  }

  const defaultPath = process.env.WATH_DEFAULT_CONSUMER_PATH?.trim();
  if (defaultPath) {
    const resolved = resolveExistingPath(root, defaultPath);
    if (resolved) return resolved;
    throw new Error(
      `WATH_DEFAULT_CONSUMER_PATH is set but wath.json not found: ${defaultPath}`
    );
  }

  const candidates = discoverConsumers(root);
  if (candidates.length === 1) {
    return candidates[0];
  }

  if (candidates.length === 0) {
    throw new Error(
      "No consumer repos found. Mount a repo under consumers/ or set WATH_DEFAULT_CONSUMER_PATH."
    );
  }

  const consumerMounts = candidates.filter((c) => c.consumerRepoPath.startsWith("consumers/"));
  if (consumerMounts.length === 1) {
    return consumerMounts[0];
  }

  throw new Error(
    `Multiple consumer repos found — specify target (repo URL or org/repo): ${candidates.map((c) => `${c.appId} → ${c.consumerRepoPath}`).join("; ")}`
  );
}

/** Absolute filesystem root for a resolved consumer path. */
export function consumerRootFromPath(
  wathRoot: string,
  consumerRepoPath: string
): string {
  return resolve(wathRoot, consumerRepoPath);
}
