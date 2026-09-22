import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Reads the current commit SHA straight out of .git/ rather than shelling
// out to `git rev-parse` -- the base image (node:22-slim, see Dockerfile)
// isn't guaranteed to have git installed, and this avoids the dependency
// entirely. Shared between vite.config.js (bakes __GIT_SHA__ into the
// frontend build) and backend/server.mjs (surfaces it on /api/version and
// /healthz) so both report the exact same value for the exact same build,
// instead of two independent implementations drifting apart.
export function gitSha(repoRoot) {
  try {
    const gitDir = path.join(repoRoot, ".git");
    const headPath = path.join(gitDir, "HEAD");
    if (!existsSync(headPath)) return "unknown";

    const head = readFileSync(headPath, "utf8").trim();
    if (!head.startsWith("ref: ")) {
      return head.slice(0, 7) || "unknown";
    }

    const refPath = path.join(gitDir, head.slice(5).replace(/\//g, path.sep));
    if (!existsSync(refPath)) return "unknown";
    return readFileSync(refPath, "utf8").trim().slice(0, 7) || "unknown";
  } catch {
    return "unknown";
  }
}
