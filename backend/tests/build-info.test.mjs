import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { resolveGitCommit, resolveGitSha, writeBuildInfo } = await import("../../scripts/build-info.mjs");

const SHA = "96409a40493ea532c8cc6f91a6fc5f4c3f008314";

// A checkout like Railway's build context: package.json, no .git.
function checkoutWithoutGit() {
  const dir = mkdtempSync(path.join(tmpdir(), "build-info-"));
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ version: "1.0.9999" }));
  return dir;
}

test("without .git and without any SHA source, the SHA is unknown -- the production bug this fixes", () => {
  const dir = checkoutWithoutGit();
  assert.equal(resolveGitSha({ repoRoot: dir, env: {} }), "unknown");
});

test("RAILWAY_GIT_COMMIT_SHA (Railway build arg / runtime var) is used when there is no .git", () => {
  const dir = checkoutWithoutGit();
  assert.deepEqual(resolveGitCommit({ repoRoot: dir, env: { RAILWAY_GIT_COMMIT_SHA: SHA } }), { sha: SHA, source: "env:RAILWAY_GIT_COMMIT_SHA" });
  assert.equal(resolveGitSha({ repoRoot: dir, env: { RAILWAY_GIT_COMMIT_SHA: SHA } }), "96409a4");
});

test("build-info.json written at build time is what the running server reports (no env needed at runtime)", () => {
  const dir = checkoutWithoutGit();
  const info = writeBuildInfo({ repoRoot: dir, env: { GIT_SHA: SHA }, requireSha: true });
  assert.equal(info.gitSha, SHA);
  assert.equal(info.version, "1.0.9999");
  assert.deepEqual(JSON.parse(readFileSync(path.join(dir, "build-info.json"), "utf8")).gitSha, SHA);
  assert.equal(resolveGitSha({ repoRoot: dir, env: {} }), "96409a4");
});

test("a production build with no SHA fails instead of shipping 'unknown'", () => {
  const dir = checkoutWithoutGit();
  assert.throws(() => writeBuildInfo({ repoRoot: dir, env: {}, requireSha: true }), /No git commit SHA available/);
  assert.equal(existsSync(path.join(dir, "build-info.json")), false);
});

test("garbage in the SHA variables is ignored, not reported as a commit", () => {
  const dir = checkoutWithoutGit();
  assert.equal(resolveGitSha({ repoRoot: dir, env: { GIT_SHA: "main", RAILWAY_GIT_COMMIT_SHA: "$(rm -rf /)" } }), "unknown");
});
