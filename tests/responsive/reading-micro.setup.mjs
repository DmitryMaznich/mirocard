import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
export default function setup() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build", "-c", "tests/responsive/reading-micro.vite.config.mjs", "--configLoader", "native"], { cwd: root, stdio: "pipe" });
  const output = new URL("../../.cache/reading-micro-preview/decks/", import.meta.url);
  mkdirSync(output, { recursive: true });
  copyFileSync(new URL("../../public/decks/reading_short_stories_v2.0.1.zip", import.meta.url), new URL("reading_short_stories_v2.0.1.zip", output));
}
