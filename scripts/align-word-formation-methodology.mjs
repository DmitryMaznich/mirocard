import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { RELEASE_TOPIC_COPY, applyReleaseTopicCopy } from "../src/topics/releaseTopicCopy.js";

const id = "word_formation_soup";
const version = "1.0.57";
const file = `${id}_v${version}.zip`;
// Keep the source ZIP intact so this migration is reproducible and reversible.
const zip = await JSZip.loadAsync(readFileSync(`public/decks/${id}_v1.0.51.zip`));
const original = JSON.parse(await zip.file("topic.json").async("string"));
for (const card of original.cards) delete card.wrongForms;
const topic = applyReleaseTopicCopy(original);
topic.version = version;
topic.meta.version = version;
topic.meta.copyHash = createHash("sha256").update(JSON.stringify(RELEASE_TOPIC_COPY[id])).digest("hex").slice(0, 16);
const text = JSON.stringify(topic, null, 2);
if (text.includes("\uFFFD")) throw new Error("Damaged text remains in the deck");
zip.file("topic.json", text);
writeFileSync(`public/decks/${file}`, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } }));
const catalogPath = "public/decks/catalog.json";
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const entry = catalog.decks.find(deck => deck.id === id);
if (!entry) throw new Error("Word formation is missing from the catalog");
entry.description = { ...entry.description, ru: RELEASE_TOPIC_COPY[id].about.description };
Object.assign(entry, { version, file, url: `./decks/${file}`, zipUrl: file });
writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
console.log(`Aligned ${id} v${version}: real words, 2–4 choices, explicit context, separate agreement.`);
