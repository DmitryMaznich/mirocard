import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { RELEASE_TOPIC_COPY, applyReleaseTopicCopy } from "../src/topics/releaseTopicCopy.js";

// Builds public/decks/place_value_v<version>.zip from public/place_value_topic.json,
// with the editorial copy from releaseTopicCopy.js baked in (same as
// sync-release-topic-copy.mjs does for already-published decks).
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(await readFile(resolve(root, "public/place_value_topic.json"), "utf8"));
const manifest = applyReleaseTopicCopy(source);
manifest.meta.copyHash = createHash("sha256").update(JSON.stringify(RELEASE_TOPIC_COPY.place_value)).digest("hex").slice(0, 16);

const zip = new JSZip();
zip.file("topic.json", `${JSON.stringify(manifest, null, 2)}\n`);
const outFile = resolve(root, `public/decks/place_value_v${manifest.meta.version}.zip`);
await writeFile(outFile, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } }));
console.log(`✓ Created ${outFile}`);
