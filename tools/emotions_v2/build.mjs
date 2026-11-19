import JSZip from "jszip";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const zip = new JSZip();

zip.file("deck.json", readFileSync(join(dir, "deck.json")));

for (const file of readdirSync(join(dir, "media"))) {
  zip.file(`media/${file}`, readFileSync(join(dir, "media", file)));
}
for (const file of readdirSync(join(dir, "audio"))) {
  zip.file(`audio/${file}`, readFileSync(join(dir, "audio", file)));
}

const output = join(dir, "emotions_v2.zip");
writeFileSync(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`Built ${output}`);
