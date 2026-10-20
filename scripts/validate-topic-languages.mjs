import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { topicLanguageBuildProof } from "./topic-language-build-proof.mjs";
import JSZip from "jszip";
import { loadTopicLanguages } from "../shared/topic-language-contract.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
let count = 0;
for (const directory of await readdir(resolve(root, "tools"), { withFileTypes: true })) {
  if (!directory.isDirectory()) continue;
  const base = resolve(root, "tools", directory.name);
  let source;
  try { source = await readFile(resolve(base, "topic.json"), "utf8"); }
  catch (error) { if (error.code === "ENOENT") continue; throw error; }
  const manifest = JSON.parse(source);
  if (!manifest.languageContract) continue;
  await loadTopicLanguages(manifest, (path) => readFile(resolve(base, path), "utf8"));
  const zip = await JSZip.loadAsync(await readFile(resolve(root, `public/decks/${manifest.meta.id}_v${manifest.meta.version}.zip`)));
  if (await zip.file("topic.json")?.async("string") !== source) throw new Error(`${directory.name}: stale ZIP manifest`);
  await loadTopicLanguages(manifest, async (path) => {
    const published = await zip.file(path)?.async("string");
    if (published !== await readFile(resolve(base, path), "utf8")) throw new Error(`${directory.name}: stale ZIP resource ${path}`);
    return published;
  });
  if (await zip.file("language-build.json")?.async("string") !== JSON.stringify(await topicLanguageBuildProof(root, manifest.meta.renderer))) throw new Error(`${directory.name}: source changed; rebuild the pilot ZIP`);
  if (!zip.file("renderer") || !zip.file("mirocard2.css")) throw new Error(`${directory.name}: missing renderer`);
  count++;
}
console.log(`Language contract: ${count} topic(s), source and published ZIP valid`);
