import { createHash } from "node:crypto";
import JSZip from "jszip";
import { RELEASE_TOPIC_COPY } from "../../src/topics/releaseTopicCopy.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(dir, "deck.json"), "utf8"));
const { meta, cards } = manifest;
const copy = RELEASE_TOPIC_COPY[meta.id];
meta.about = { ...meta.about, ...copy.about, text: copy.about.description };
meta.copyHash = createHash("sha256").update(JSON.stringify(copy)).digest("hex").slice(0, 16);
for (const mode of manifest.modes) {
  mode.methodology = { ...mode.methodology, ...copy.modes[mode.id] };
}
const output = join(dir, "../../public/decks", `${meta.id}_v${meta.version}.zip`);
if (existsSync(output)) throw new Error(`Refusing to overwrite ${output}`);

const zip = new JSZip();
zip.file("deck.json", JSON.stringify(manifest, null, 2) + "\n");
const files = new Set(cards.flatMap((card) => [
  card.image, card.sceneImage, card.revealImage, ...Object.values(card.audio ?? {}),
]).filter(Boolean));
for (const file of [...files].sort()) zip.file(file, readFileSync(join(dir, file)));

writeFileSync(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`Built ${output}`);
