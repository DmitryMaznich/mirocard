import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
for (const args of [["ci"], ["ci", "--prefix", "backend"], ["run", "prebuild"]]) {
  const result = spawnSync("npm", args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Mirocard ready. Start manually with: node .devcontainer/start.mjs");
