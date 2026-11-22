import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import JSZip from "jszip";
import { getMathHousesAssetEntries } from "../src/topics/builtinAssets.js";
import { applyReleaseTopicCopy, RELEASE_TOPIC_COPY } from "../src/topics/releaseTopicCopy.js";
import {
  MATH_HOUSE_MODES,
  NUMBER_COMPOSITION_ICON,
  NUMBER_COMPOSITION_TITLE,
  NUMBER_PATH_MODE,
  NUMBER_PATH_NUMBERS,
} from "../src/topics/renderers/math_houses/numberPathConfig.js";

const topicId = "math_houses";
const houseColors = ["#7c6fd6", "#d1637f", "#c97a3d", "#2f9e8f", "#a756b0", "#a97449", "#2f8f9e", "#8c3d5e", "#5b4d9e"];
const catalog = JSON.parse(readFileSync(new URL("../public/decks/catalog.json", import.meta.url), "utf8"));
const entry = catalog.decks.find((deck) => deck.id === topicId);
const manifest = applyReleaseTopicCopy({
  meta: {
    id: topicId,
    version: entry.version,
    renderer: topicId,
    cardType: "procedural",
    title: NUMBER_COMPOSITION_TITLE,
    about: RELEASE_TOPIC_COPY.math_houses.about,
    copyHash: createHash("sha256").update(JSON.stringify(RELEASE_TOPIC_COPY.math_houses)).digest("hex").slice(0, 16),
    conceptCount: NUMBER_PATH_NUMBERS.length,
    avatar: NUMBER_COMPOSITION_ICON,
  },
  cards: NUMBER_PATH_NUMBERS.map((number, index) => ({
    id: `house_${number}`,
    conceptId: `house_${number}`,
    renderer: topicId,
    primary: true,
    label: `Домик ${number}`,
    params: { number, color: houseColors[index] },
  })),
  modes: [...MATH_HOUSE_MODES, NUMBER_PATH_MODE],
});

const zip = new JSZip();
const fileOptions = { date: new Date("2000-01-01T00:00:00Z"), createFolders: false };
zip.file("topic.json", JSON.stringify(manifest, null, 2), fileOptions);
for (const [path, svg] of getMathHousesAssetEntries()) zip.file(path, svg, fileOptions);

const out = new URL(`../public/${entry.url}`, import.meta.url);
writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(out.pathname);
