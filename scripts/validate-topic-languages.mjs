import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { topicLanguageBuildProof } from "./topic-language-build-proof.mjs";
import JSZip from "jszip";
import { sha256Bytes } from "../shared/topic-delivery.mjs";
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
  const resources = {};
  if (manifest.languageContract.delivery) {
    if (Object.keys(zip.files).some((name) => !zip.files[name].dir && name.startsWith("content/"))) throw new Error("Core contains language files");
    for (const descriptor of Object.values(manifest.languageContract.packages)) {
      const data = await readFile(resolve(root, "public", descriptor.download.url.replace(/^\.\//, "")));
      if (data.length !== descriptor.download.bytes || await sha256Bytes(data) !== descriptor.download.sha256) throw new Error("Language archive integrity mismatch");
      const languageZip = await JSZip.loadAsync(data);
      const pack = JSON.parse(await languageZip.file(descriptor.file).async("string"));
      const allowed = [descriptor.file, ...(pack.assets ?? []).map((a) => a.path)];
      if (Object.keys(languageZip.files).some((name) => !languageZip.files[name].dir && !allowed.includes(name))) throw new Error("Unexpected language file");
      for (const path of allowed) {
        const published = await languageZip.file(path)?.async("nodebuffer");
        if (!published || !published.equals(await readFile(resolve(base, path)))) throw new Error(`Stale language file ${path}`);
        if (path === descriptor.file) resources[path] = published.toString("utf8");
        const asset = pack.assets?.find((a) => a.path === path);
        if (asset && (published.length !== asset.bytes || await sha256Bytes(published) !== asset.sha256)) throw new Error(`Bad asset ${path}`);
      }
    }
    const catalog = JSON.parse(await readFile(resolve(root, "public/decks/catalog.json"), "utf8"));
    const delivery = catalog.decks.find((e) => e.id === manifest.meta.id).languageDownload;
    const core = await readFile(resolve(root, `public/decks/${manifest.meta.id}_v${manifest.meta.version}.zip`));
    if (delivery.core.bytes !== core.length || delivery.core.sha256 !== await sha256Bytes(core)) throw new Error("Stale core descriptor");
    for (const [code, part] of Object.entries(delivery.languages)) if (part.sha256 !== manifest.languageContract.packages[code]?.download.sha256) throw new Error("Stale catalog language descriptor");
  }
  await loadTopicLanguages(manifest, async (path) => {
    const published = resources[path] ?? await zip.file(path)?.async("string");
    if (published !== await readFile(resolve(base, path), "utf8")) throw new Error(`${directory.name}: stale ZIP resource ${path}`);
    return published;
  });
  if (await zip.file("language-build.json")?.async("string") !== JSON.stringify(await topicLanguageBuildProof(root, manifest.meta.renderer))) throw new Error(`${directory.name}: source changed; rebuild the pilot ZIP`);
  if (!zip.file("renderer") || !zip.file("mirocard2.css")) throw new Error(`${directory.name}: missing renderer`);
  count++;
}
console.log(`Language contract: ${count} topic(s), source and published ZIP valid`);
