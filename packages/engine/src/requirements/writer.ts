import { writeFileSync, readFileSync, existsSync } from "node:fs";

import { parseWathSpec } from "../requirements/parser.js";

/** Merge feedback for a standard into wath.json on disk. */
export function writeWathFeedback(
  wathPath: string,
  standardId: string,
  feedback: Record<string, unknown>
): void {
  if (!existsSync(wathPath)) {
    throw new Error(`wath.json not found: ${wathPath}`);
  }
  const raw = readFileSync(wathPath, "utf8");
  const doc = JSON.parse(raw) as Record<string, unknown>;
  const existing = (doc.feedback as Record<string, unknown>) ?? {};
  doc.feedback = {
    ...existing,
    [standardId]: {
      ...((existing[standardId] as Record<string, unknown>) ?? {}),
      ...feedback,
      updated_at: new Date().toISOString(),
    },
  };
  writeFileSync(wathPath, JSON.stringify(doc, null, 2) + "\n", "utf8");
}

/** Append manifest-level feedback. */
export function writeManifestFeedback(
  wathPath: string,
  feedback: Record<string, unknown>
): void {
  writeWathFeedback(wathPath, "_manifest", feedback);
}

/** Read parsed spec after optional feedback write. */
export function readWathSpec(wathPath: string) {
  return parseWathSpec(wathPath);
}
