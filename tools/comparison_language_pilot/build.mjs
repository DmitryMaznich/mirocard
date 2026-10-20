import JSZip from "jszip";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { topicLanguageBuildProof } from "../../scripts/topic-language-build-proof.mjs";
import { loadTopicLanguages } from "../../shared/topic-language-contract.mjs";

const base = new URL("./", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("topic.json", base), "utf8"));
await loadTopicLanguages(manifest, (path) => readFile(new URL(path, base), "utf8"));
execFileSync("npm", ["run", "build:renderer"], {
  cwd: fileURLToPath(new URL("../../", base)),
  env: { ...process.env, RENDERER: manifest.meta.renderer },
  stdio: "inherit",
});
const zip = new JSZip();
zip.file("language-build.json", JSON.stringify(await topicLanguageBuildProof(fileURLToPath(new URL("../../", base)), manifest.meta.renderer)));
const files = ["topic.json", "media/avatar.svg", ...Object.values(manifest.languageContract.ui), ...Object.values(manifest.languageContract.packages).map((p) => p.file)];
for (const path of files) zip.file(path, await readFile(new URL(path, base)));
zip.file("renderer", await readFile(new URL("dist/renderer", base)));
zip.file("mirocard2.css", await readFile(new URL("dist/mirocard2.css", base)));
const output = new URL(`../../public/decks/${manifest.meta.id}_v${manifest.meta.version}.zip`, base);
await writeFile(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
await copyFile(output, new URL(`${manifest.meta.id}.zip`, base));
console.log(`Built isolated pilot: ${fileURLToPath(output)}`);
