#!/usr/bin/env node
// Release identity: which exact commit a running deployment was built from.
//
// Railway builds this repo from a Dockerfile with no .git in the build
// context, so reading .git (scripts/git-sha.mjs) alone produced
// gitSha: "unknown" in production. The commit SHA now comes from, in order:
//   1. MIROCARD_GIT_SHA / GIT_SHA / RAILWAY_GIT_COMMIT_SHA env vars --
//      Railway passes RAILWAY_GIT_COMMIT_SHA into a Dockerfile build as a
//      build arg (ARG in Dockerfile) and into the running container;
//   2. build-info.json, written into the image at build time (see
//      Dockerfile: `node scripts/build-info.mjs --write --require-sha`);
//   3. .git, for local development only.
//
// The Docker build fails when no SHA is available, so an image that can't
// say which commit it is never reaches production.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gitSha as gitShaFromDotGit } from "./git-sha.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BUILD_INFO_FILE = "build-info.json";
const SHA_RE = /^[0-9a-f]{7,40}$/i;
const SHA_ENV_VARS = ["MIROCARD_GIT_SHA", "GIT_SHA", "RAILWAY_GIT_COMMIT_SHA"];

function shaFromEnv(env) {
  for (const name of SHA_ENV_VARS) {
    const value = String(env[name] ?? "").trim();
    if (SHA_RE.test(value)) return { sha: value.toLowerCase(), source: `env:${name}` };
  }
  return null;
}

export function readBuildInfo(repoRoot = REPO_ROOT) {
  try {
    const info = JSON.parse(readFileSync(path.join(repoRoot, BUILD_INFO_FILE), "utf8"));
    return SHA_RE.test(info?.gitSha ?? "") ? info : null;
  } catch {
    return null;
  }
}

/** Full SHA (or best available) plus where it came from. */
export function resolveGitCommit({ repoRoot = REPO_ROOT, env = process.env } = {}) {
  const fromEnv = shaFromEnv(env);
  if (fromEnv) return fromEnv;
  const info = readBuildInfo(repoRoot);
  if (info) return { sha: info.gitSha.toLowerCase(), source: BUILD_INFO_FILE };
  const local = gitShaFromDotGit(repoRoot);
  if (local !== "unknown") return { sha: local, source: ".git" };
  return { sha: "unknown", source: "none" };
}

/** The 7-char form exposed on /api/version, /healthz and in the bundle. */
export function resolveGitSha(options) {
  const { sha } = resolveGitCommit(options);
  return sha === "unknown" ? sha : sha.slice(0, 7);
}

export function writeBuildInfo({ repoRoot = REPO_ROOT, env = process.env, requireSha = false } = {}) {
  const { sha, source } = resolveGitCommit({ repoRoot, env });
  if (sha === "unknown" && requireSha) {
    throw new Error(
      "No git commit SHA available for this build. Railway passes RAILWAY_GIT_COMMIT_SHA automatically "
      + "(declared as ARG in the Dockerfile); for a manual build use "
      + "`docker build --build-arg GIT_SHA=$(git rev-parse HEAD) .`",
    );
  }
  const version = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")).version ?? "unknown";
  const info = { gitSha: sha, version, source, builtAt: new Date().toISOString() };
  writeFileSync(path.join(repoRoot, BUILD_INFO_FILE), `${JSON.stringify(info, null, 2)}\n`);
  return info;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    try {
      const info = writeBuildInfo({ requireSha: process.argv.includes("--require-sha") });
      console.log(`build-info: ${info.version} @ ${info.gitSha} (from ${info.source})`);
    } catch (err) {
      console.error(`build-info: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log(JSON.stringify({ ...resolveGitCommit(), exists: existsSync(path.join(REPO_ROOT, BUILD_INFO_FILE)) }));
  }
}
