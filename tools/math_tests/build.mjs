// «Контрольные по математике» (math_tests) deck: only topic.json — the renderer is bundled with the
// app (src/topics/renderers/math_tests, it uses the app's PDF maker and reward video).
// Usage: node tools/math_tests/build.mjs
// Then copy math_tests.zip to public/decks/math_tests_v<version>.zip and point
// public/decks/catalog.json at it (CLAUDE.md, "Deck-zip topics").
import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const topic = JSON.parse(readFileSync(join(DIR, "topic.json"), "utf8"));
const zip = new JSZip();
zip.file("topic.json", readFileSync(join(DIR, "topic.json"), "utf8"));
const out = join(DIR, "math_tests.zip");
writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`✓ ${out} — v${topic.meta.version}`);
