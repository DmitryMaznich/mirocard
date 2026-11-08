// «Латиница» (latin_letters) deck: the Latin handwriting notebook
// constructor (docs/latin-letters.md). The glyphs live in the renderer
// (glyphs/*.json, built by tools/latin_letters/glyphs/*.mjs); topic.json here is meta + modes.
// Usage: node tools/latin_letters/build.mjs
// Then copy latin_letters.zip to public/decks/latin_letters_v<version>.zip and
// point public/decks/catalog.json at it (CLAUDE.md, "Deck-zip topics").
import JSZip from "jszip";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, "..", "..");
const RENDERER_DIR = join(ROOT, "src", "topics", "renderers", "latin_letters");

const topic = JSON.parse(readFileSync(join(DIR, "topic.json"), "utf8"));
const { version } = topic.meta;

console.log("Building renderer…");
execSync("npm run build:renderer", { cwd: ROOT, env: { ...process.env, RENDERER: "latin_letters" }, stdio: "inherit", shell: true });
const dist = join(DIR, "dist");

const zip = new JSZip();
zip.file("topic.json", readFileSync(join(DIR, "topic.json"), "utf8"));
zip.file("renderer", readFileSync(join(dist, "renderer")));
if (existsSync(join(dist, "mirocard2.css"))) zip.file("mirocard2.css", readFileSync(join(dist, "mirocard2.css")));
// The avatar lives with the renderer (it is also the bundled fallback's).
zip.file(topic.meta.avatar, readFileSync(join(RENDERER_DIR, topic.meta.avatar)));
// The modes' icons (topic.json modes[].ui.icon) live there too.
for (const icon of new Set(topic.modes.map((m) => m.ui?.icon).filter(Boolean))) zip.file(icon, readFileSync(join(RENDERER_DIR, icon)));

const out = join(DIR, "latin_letters.zip");
writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`✓ ${out} — v${version}, ${topic.cards.length} cards`);
