import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Reads the current commit SHA straight out of .git/ rather than shelling
// out to `git rev-parse` -- the base image (node:22-slim, see Dockerfile)
// isn't guaranteed to have git installed, and this avoids the dependency
// entirely. Shared between vite.config.js (bakes __GIT_SHA__ into the
// frontend build) and backend/server.mjs (surfaces it on /api/version and
// /healthz) so both report the exact same value for the exact same build,
// instead of two independent implementations drifting apart.
//
// Handles both a plain clone (.git is a directory) and a git worktree or
// submodule (.git is a *file* containing `gitdir: <path>`, pointing at a
// per-worktree metadata dir that itself has its own HEAD but shares
// refs/objects with the main repo via a `commondir` file) -- a normal
// `git rev-parse` shells out and doesn't care, but reading the files by
// hand does need to resolve this, or gitSha() silently returns "unknown"
// for any build run from inside a worktree (confirmed while developing
// this very launch-prep branch, which is itself a worktree).
export function gitSha(repoRoot) {
  try {
    const dotGitPath = path.join(repoRoot, ".git");
    if (!existsSync(dotGitPath)) return "unknown";

    let gitDir = dotGitPath;
    if (!statSync(dotGitPath).isDirectory()) {
      // Worktree/submodule pointer file: "gitdir: /path/to/.git/worktrees/<name>"
      const pointer = readFileSync(dotGitPath, "utf8").trim();
      const match = pointer.match(/^gitdir:\s*(.+)$/);
      if (!match) return "unknown";
      gitDir = path.resolve(repoRoot, match[1]);
      if (!existsSync(gitDir)) return "unknown";
    }

    const headPath = path.join(gitDir, "HEAD");
    if (!existsSync(headPath)) return "unknown";
    const head = readFileSync(headPath, "utf8").trim();
    if (!head.startsWith("ref: ")) {
      return head.slice(0, 7) || "unknown";
    }

    // A worktree's HEAD ref (e.g. refs/heads/main) lives in the shared
    // "common" git dir, not the worktree-specific one -- resolve via
    // `commondir` when present (plain repos have no such file, and
    // resolving against gitDir itself is then correct).
    const commonDirFile = path.join(gitDir, "commondir");
    const commonDir = existsSync(commonDirFile)
      ? path.resolve(gitDir, readFileSync(commonDirFile, "utf8").trim())
      : gitDir;

    const refRelative = head.slice(5).trim();
    const refPath = path.join(commonDir, refRelative.replace(/\//g, path.sep));
    if (!existsSync(refPath)) return "unknown";
    return readFileSync(refPath, "utf8").trim().slice(0, 7) || "unknown";
  } catch {
    return "unknown";
  }
}
