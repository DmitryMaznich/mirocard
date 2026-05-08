#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

console.warn("deploy-163.mjs is deprecated. Use npm run deploy:prod.");

const script = fileURLToPath(new URL("./deploy-prod.mjs", import.meta.url));
const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
