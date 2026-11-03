import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import sharp from "sharp";
import { applyReleaseTopicCopy, RELEASE_TOPIC_COPY } from "../src/topics/releaseTopicCopy.js";

const version = "2.0.3";
const source = JSON.parse(await readFile("content/reading_short_stories/micro/stories.json", "utf8"));
const illustrationTemplate = JSON.parse(await readFile("docs/design/reading-sheet-illustrations.template.json", "utf8"));
function frameCrop(width, height, spec) {
  const inset = illustrationTemplate.source_edge_inset;
  const side = Math.min(width, height) * (1 - 2 * inset);
  const left = Math.max(width * inset, Math.min(width * spec.focus[0] - side / 2, width * (1 - inset) - side));
  const top = Math.max(height * inset, Math.min(height * spec.focus[1] - side / 2, height * (1 - inset) - side));
  const crop = { left: left / width, top: top / height, width: side / width, height: side / height };
  const [x1, y1, x2, y2] = spec.protected_bounds;
  if (crop.left > x1 || crop.top > y1 || crop.left + crop.width < x2 || crop.top + crop.height < y2) {
    throw new Error("Square crop removes meaningful content: recompose the illustration instead.");
  }
  return crop;
}
const stripSyllables = (value) => value.replace(/(\p{L})-(?=\p{L})/gu, "$1");
// Preserve the previous edition, its illustrations and per-story stable ids.
const zip = await JSZip.loadAsync(await readFile("public/decks/reading_short_stories_v1.6.4.zip"));
const previous = JSON.parse(await zip.file("topic.json").async("string"));
const legacyQuestions = await zip.file("questions.txt").async("string");
const previousMicroZip = await JSZip.loadAsync(await readFile("public/decks/reading_short_stories_v2.0.2.zip"));
const previousMicroManifest = JSON.parse(await previousMicroZip.file("topic.json").async("string"));
const microQuestions = source.map((story) => `# ${story.title}\n\n${story.find.map(([question, target]) => `? ${question}\n+ ${target}`).join("\n\n")}\n\n* ${story.discuss}`).join("\n\n");
const microStories = [];

for (const story of source) {
  const illustration = illustrationTemplate.stories[story.id] ?? {};
  const input = `scripts/assets/reading_short_stories/micro/${illustration.source ?? `${story.id}.png`}`;
  const { width, height } = await sharp(input).metadata();
  const half = Math.floor(width / 2);
  const images = [];
  for (let index = 0; index < 2; index += 1) {
    const file = `media/micro/${story.id}_${index + 1}.webp`;
    const buffer = await sharp(input)
      .extract({ left: index * half, top: 0, width: half, height })
      .resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 }).toBuffer();
    zip.file(file, buffer);
    const frameSpec = illustration.frames?.[index] ?? (story.id === "micro_ball" ? illustrationTemplate.frames[index] : illustrationTemplate.default_frame);
    images.push({ file, alt: story.frames[index], crop: frameCrop(half, height, frameSpec) });
  }
  microStories.push({
    id: story.id, kind: "story", title: { ru: story.title },
    storyStage: "micro", level: 1, character: story.character,
    sentenceLayout: true, minimumFindQuestions: 3,
    illustrationSupport: "on_request", image: images[0].file, images,
    discussionPrompt: story.discuss, discussionAnswer: story.answer,
    lines: story.lines.map((syllableText, index) => ({ id: `l${index + 1}`, text: stripSyllables(syllableText), syllableText })),
  });
}

const stageParam = {
  type: "enum", label: { ru: "Ступень" }, values: ["micro", "extended"],
  labels: { ru: { micro: "1. Микрорассказы: 4–5 предложений", extended: "Прежние рассказы: подлиннее" } }, default: "micro",
};
const microSelection = {
  type: "enum_multi", label: { ru: "Микрорассказы" },
  values: source.map((story) => story.id),
  labels: { ru: Object.fromEntries(source.map((story) => [story.id, story.title])) },
  default: [], showWhen: { storyStage: "micro" },
};
const modes = previous.modes.map((mode) => ({ ...mode, params: {
  storyStage: stageParam,
  selectedMicroStories: microSelection,
  ...mode.params,
  selectedStories: { ...mode.params.selectedStories, showWhen: { storyStage: "extended" } },
} }));
const questions = `${microQuestions}\n\n${legacyQuestions.trim()}\n`;
const manifest = applyReleaseTopicCopy({
  ...previous,
  meta: {
    ...previous.meta, version, minAppVersion: "1.0.2779", defaultStoryStage: "micro",
    conceptCount: microStories.length + previous.texts.length,
    sessionConfig: { ...previous.meta.sessionConfig, maxSize: 27 },
    description: {
      ru: RELEASE_TOPIC_COPY.reading_short_stories.about.description,
      en: "Fifteen micro-stories with recurring children, name questions and optional picture support, plus the twelve previous stories.",
    },
  },
  modes,
  texts: [...microStories, ...previous.texts.map((story) => ({ ...story, storyStage: "extended", level: 2 }))],
  storyQuiz: { ...previous.storyQuiz, defaultText: questions, previousDefaultTexts: [...(previousMicroManifest.storyQuiz.previousDefaultTexts ?? []), previousMicroManifest.storyQuiz.defaultText] },
});
manifest.meta.copyHash = createHash("sha256").update(JSON.stringify(RELEASE_TOPIC_COPY.reading_short_stories)).digest("hex").slice(0, 16);
zip.file("topic.json", `${JSON.stringify(manifest, null, 2)}\n`);
zip.file("questions.txt", questions);
zip.file("micro-sources.json", JSON.stringify({
  text: "Original educational drafts prepared for this project; see content/reading_short_stories/micro/stories.json.",
  illustrations: "Generated for this project with OpenAI image_gen; four diptychs recomposed for square frames on 2026-11-02. No third-party storybook illustrations used.",
  sourceNotes: "Separate character reference, prompts and original two-panel images are retained in scripts/assets/reading_short_stories/micro/.",
}, null, 2));
const filename = `reading_short_stories_v${version}.zip`;
await writeFile(`public/decks/${filename}`, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } }));
await writeFile("content/reading_short_stories/micro/questions.txt", `${microQuestions}\n`);
const catalogPath = "public/decks/catalog.json";
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const entry = catalog.decks.find((deck) => deck.id === previous.meta.id);
Object.assign(entry, { version, url: `./decks/${filename}`, description: manifest.meta.description });
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
// Update only this topic: the inventory can also contain other in-progress work.
const inventoryPath = "backend/generated/topic-inventory.json";
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const inventoryEntry = inventory.topics.find((item) => item.id === manifest.meta.id);
if (inventoryEntry) {
  inventoryEntry.version = version;
  inventoryEntry.sources = inventoryEntry.sources.map((file) => file.startsWith("public/decks/reading_short_stories_v") ? `public/decks/${filename}` : file);
  inventoryEntry.catalogEntry = entry;
  inventoryEntry.bundle = {
    ...inventoryEntry.bundle, version, url: entry.url, title: manifest.meta.title,
    description: manifest.meta.about.description, renderer: "reading",
    modes: manifest.modes.length, cards: manifest.cards.length,
  };
  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
}
console.log(`Built ${filename}: ${microStories.length} micro-stories, 30 frames, 60 questions; ${previous.texts.length} previous stories retained.`);
