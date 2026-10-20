import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

// Detect a source-only renderer/engine edit that forgot to rebuild its ZIP.
export async function topicLanguageBuildProof(root, renderer) {
  if (!/^[a-z][a-z0-9_]*$/.test(renderer)) throw new Error("Invalid renderer ID");
  const directory = `src/topics/renderers/${renderer}`;
  const names = (await readdir(resolve(root, directory)))
    .filter((name) => /\.(js|jsx|css)$/.test(name) && !/\.(test|spec)\./.test(name)).sort();
  const files = ["shared/topic-language-contract.mjs", ...names.map((name) => `${directory}/${name}`)];
  return Object.fromEntries(await Promise.all(files.map(async (file) => [file, createHash("sha256").update(await readFile(resolve(root, file))).digest("hex")])));
}
