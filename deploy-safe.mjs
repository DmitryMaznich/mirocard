#!/usr/bin/env node
// Careful wrapper around `npm run deploy:prod`: pulls the latest main,
// verifies nothing is broken, then deploys — aborting immediately (and
// leaving the repo untouched) at the first sign of trouble, instead of
// pushing a build that turns out to be stale or broken.
//
// Usage: node deploy-safe.mjs   (or: npm run deploy:safe)
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

// String commands through execSync (not execFileSync) — same choice
// deploy-prod.mjs already makes, since npm/npx resolve to .cmd shims on
// Windows and need a shell to run.
function run(command) {
  execSync(command, { cwd: root, stdio: "inherit" });
}

function output(command) {
  return execSync(command, { cwd: root, encoding: "utf8" }).trim();
}

function step(label, fn) {
  console.log(`\n=== ${label} ===`);
  try {
    fn();
  } catch (err) {
    console.error(`\n✗ FAILED: ${label}`);
    if (err.message) console.error(err.message);
    console.error("\nNothing further was run. Fix the issue above and re-run this script.");
    process.exit(1);
  }
  console.log(`✓ ${label} — OK`);
}

step("Checking for uncommitted local changes", () => {
  const status = output("git status --porcelain");
  if (status) {
    console.error(status);
    throw new Error("You have uncommitted changes — commit or stash them first, so a pull can't conflict with your work.");
  }
});

step("Pulling latest main", () => {
  run("git fetch origin main");
  run("git pull origin main");
});

step("Running word_agreement tests", () => {
  run("npx vitest run src/topics/renderers/word_agreement/engine.test.js src/shared/utils/topicUtils.test.js");
});

step("Building the app", () => {
  run("npm run build");
});

step("Deploying to production", () => {
  run("npm run deploy:prod");
});

console.log("\n✓ Deploy complete.");
