import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const zip = new JSZip();

zip.file("topic.json", readFileSync(join(dir, "topic.json")));
zip.file("renderer", readFileSync(join(dir, "renderer.js")));
zip.file("mirocard2.css", readFileSync(join(dir, "renderer.css")));
zip.file("media/avatar.svg", readFileSync(join(dir, "media", "avatar.svg")));

const output = join(dir, "symmetry_draw.zip");
writeFileSync(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`Built ${output}`);
