import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gitSha } from "../../scripts/git-sha.mjs";

function makePlainRepo(sha) {
  const root = mkdtempSync(path.join(tmpdir(), "mirocard-gitsha-plain-"));
  const gitDir = path.join(root, ".git");
  mkdirSync(path.join(gitDir, "refs", "heads"), { recursive: true });
  writeFileSync(path.join(gitDir, "HEAD"), "ref: refs/heads/main\n");
  writeFileSync(path.join(gitDir, "refs", "heads", "main"), `${sha}\n`);
  return root;
}

function makeDetachedRepo(sha) {
  const root = mkdtempSync(path.join(tmpdir(), "mirocard-gitsha-detached-"));
  mkdirSync(path.join(root, ".git"));
  writeFileSync(path.join(root, ".git", "HEAD"), `${sha}\n`);
  return root;
}

// Reproduces the actual bug found while building this: gitSha() returned
// "unknown" for every build run from inside a git worktree (which is
// exactly what this launch-prep branch itself is) because .git there is a
// *file* pointing at a separate per-worktree metadata dir, and the branch
// ref it points to (via HEAD: "ref: refs/heads/...") lives in the shared
// main repo's refs/, not the worktree's own dir -- resolved via a
// `commondir` file.
function makeWorktreeRepo(sha) {
  const root = mkdtempSync(path.join(tmpdir(), "mirocard-gitsha-worktree-"));
  const mainGitDir = mkdtempSync(path.join(tmpdir(), "mirocard-gitsha-main-"));
  mkdirSync(path.join(mainGitDir, "refs", "heads"), { recursive: true });
  writeFileSync(path.join(mainGitDir, "refs", "heads", "launch-branch"), `${sha}\n`);

  const worktreeGitDir = path.join(mainGitDir, "worktrees", "launch-prep");
  mkdirSync(worktreeGitDir, { recursive: true });
  writeFileSync(path.join(worktreeGitDir, "HEAD"), "ref: refs/heads/launch-branch\n");
  writeFileSync(path.join(worktreeGitDir, "commondir"), "../..\n");

  writeFileSync(path.join(root, ".git"), `gitdir: ${worktreeGitDir}\n`);
  return root;
}

test("gitSha reads the short SHA from a plain repo (.git is a directory, HEAD is a symbolic ref)", () => {
  const root = makePlainRepo("abcdef1234567890");
  assert.equal(gitSha(root), "abcdef1");
});

test("gitSha reads the short SHA from a detached HEAD (.git/HEAD is the SHA directly)", () => {
  const root = makeDetachedRepo("1234567abcdef890");
  assert.equal(gitSha(root), "1234567");
});

test("gitSha resolves a worktree's .git file + commondir-relative ref correctly", () => {
  const root = makeWorktreeRepo("deadbeef00112233");
  assert.equal(gitSha(root), "deadbee");
});

test("gitSha returns \"unknown\" for a directory with no .git at all", () => {
  const root = mkdtempSync(path.join(tmpdir(), "mirocard-gitsha-none-"));
  assert.equal(gitSha(root), "unknown");
});

test("gitSha returns \"unknown\" rather than throwing for a malformed worktree pointer", () => {
  const root = mkdtempSync(path.join(tmpdir(), "mirocard-gitsha-malformed-"));
  writeFileSync(path.join(root, ".git"), "not a real gitdir pointer\n");
  assert.equal(gitSha(root), "unknown");
});

// Symlinks are the closest cheap stand-in for "not a git checkout we can
// read" without needing an actual second real repo -- just proving this
// doesn't throw for an unusual filesystem entry at .git/HEAD.
test("gitSha does not throw for an unreadable HEAD", () => {
  const root = mkdtempSync(path.join(tmpdir(), "mirocard-gitsha-badhead-"));
  mkdirSync(path.join(root, ".git"));
  symlinkSync("/nonexistent-target-xyz", path.join(root, ".git", "HEAD"));
  assert.doesNotThrow(() => gitSha(root));
});
