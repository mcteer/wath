import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { resolveApplicationId } from "../lifecycle/state.js";
import { fetchWathSpecFromRepo } from "../requirements/fetch-wath-spec.js";
import { parseWathSpec, type WathSpec } from "../requirements/parser.js";
import { resolveRepoRoot } from "../standards/registry.js";

export interface ResolveConsumerInput {
  consumerRepoPath?: string;
  /** Repo URL from wath.json — preferred MCP tool argument. */
  repo?: string;
  /** Repo URL, org/repo app id, or local path under WATH_ROOT. */
  target?: string;
  repoUrl?: string;
  /** Optional fallback when MCP client sends X-Wath-Consumer-Repo (not written to mcp.json). */
  consumerRepoHeader?: string;
}

export interface ResolvedConsumer {
  repo: string;
  appId: string;
  wathSpec: WathSpec;
  /** Primary spec source for cloud onboarding. */
  source: "remote" | "local";
  /** Absolute path to wath.json when a local checkout exists. */
  wathPath?: string;
  /** Path relative to WATH_ROOT when locally mounted (optional — verify/materialize only). */
  localConsumerPath?: string;
}

function normalizeRepoUrl(url: string): string {
  return url.replace(/\.git$/, "").replace(/\/$/, "");
}

function isAppId(value: string): boolean {
  return /^[^/]+\/[^/]+$/.test(value) && !value.includes("github.com");
}

function toRepoUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes("github.com")) {
    return normalizeRepoUrl(trimmed);
  }
  if (isAppId(trimmed)) {
    return `https://github.com/${trimmed}`;
  }
  throw new Error(
    `Invalid repo target "${value}" — use https://github.com/org/repo or org/repo`
  );
}

function searchRoots(wathRoot: string): string[] {
  const configured = process.env.WATH_CONSUMER_SEARCH_PATHS?.trim();
  const relRoots = configured
    ? configured.split(",").map((s) => s.trim()).filter(Boolean)
    : ["consumers"];
  return relRoots.map((r) => join(wathRoot, r)).filter((p) => existsSync(p));
}

function findLocalMountForRepo(
  wathRoot: string,
  repoUrl: string
): { localConsumerPath: string; wathPath: string } | null {
  const target = normalizeRepoUrl(repoUrl).toLowerCase();

  for (const root of searchRoots(wathRoot)) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const wathJson = join(root, entry.name, "wath.json");
      if (!existsSync(wathJson)) continue;
      try {
        const spec = parseWathSpec(wathJson);
        if (normalizeRepoUrl(spec.repo).toLowerCase() === target) {
          const localConsumerPath = relative(wathRoot, join(root, entry.name));
          return { localConsumerPath, wathPath: wathJson };
        }
      } catch {
        // skip invalid trees
      }
    }
  }
  return null;
}

function resolveRepoUrlFromInput(input: ResolveConsumerInput): string | undefined {
  const explicit =
    input.repo?.trim() ||
    input.consumerRepoHeader?.trim() ||
    input.target?.trim() ||
    input.repoUrl?.trim();

  if (explicit) {
    if (explicit.includes("/") && !explicit.includes("github.com") && !isAppId(explicit)) {
      return undefined;
    }
    return toRepoUrl(explicit);
  }

  const fromEnv = process.env.WATH_DEFAULT_CONSUMER_REPO?.trim();
  if (fromEnv) return toRepoUrl(fromEnv);

  return undefined;
}

/**
 * Resolve the application to onboard by repo URL (from header, args, or wath.json on GitHub).
 * Local mounts under consumers/ are optional — used only for verify/materialize when present.
 */
export async function resolveConsumer(
  input: ResolveConsumerInput = {},
  wathRoot?: string
): Promise<ResolvedConsumer> {
  const root = wathRoot ?? resolveRepoRoot();

  let repoUrl = resolveRepoUrlFromInput(input);

  if (!repoUrl && input.consumerRepoPath?.trim()) {
    const wathJson = join(root, input.consumerRepoPath.trim(), "wath.json");
    if (existsSync(wathJson)) {
      repoUrl = normalizeRepoUrl(parseWathSpec(wathJson).repo);
    }
  }

  if (!repoUrl) {
    throw new Error(
      'Application repo required — read wath.json and pass the "repo" field to wath.onboard.'
    );
  }

  const local = findLocalMountForRepo(root, repoUrl);
  let wathSpec: WathSpec;
  let source: ResolvedConsumer["source"] = "remote";

  try {
    wathSpec = await fetchWathSpecFromRepo(repoUrl);
  } catch (remoteErr) {
    if (local) {
      wathSpec = parseWathSpec(local.wathPath);
      source = "local";
    } else {
      throw remoteErr;
    }
  }

  return {
    repo: wathSpec.repo,
    appId: resolveApplicationId(wathSpec.repo),
    wathSpec,
    source,
    wathPath: local?.wathPath,
    localConsumerPath: local?.localConsumerPath,
  };
}

/** @deprecated Use resolveConsumer */
export async function resolveConsumerRepoPath(
  input: ResolveConsumerInput = {},
  wathRoot?: string
): Promise<ResolvedConsumer & { consumerRepoPath: string }> {
  const resolved = await resolveConsumer(input, wathRoot);
  return {
    ...resolved,
    consumerRepoPath:
      resolved.localConsumerPath ?? `remote/${resolved.appId.replace("/", "-")}`,
  };
}
