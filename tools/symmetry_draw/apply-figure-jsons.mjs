import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSymmetryDrawDeckBuffer } from "./build.mjs";
import { buildFiguresGallery } from "./build-figures-gallery.mjs";
import { FIGURES_DIR, ROOT, TOPIC_PATH, clone, exportFigureJsons, fitFigureToGrid, mergeFigureGeometry, nextPatchVersion, normalizeFigureGridNoise, readTopic, validateFigureCard } from "./figure-jsons.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const refreshRuntime = args.includes("--refresh");
const addFigures = args.includes("--add");
const files = args.filter((argument) => argument !== "--dry-run" && argument !== "--refresh" && argument !== "--add");

if (!files.length && !refreshRuntime) {
  console.error("Usage: node tools/symmetry_draw/apply-figure-jsons.mjs [--dry-run] [--refresh] [--add] <figure.json> [...]");
  process.exitCode = 1;
} else {
  const corrected = files.flatMap((file) => {
    const path = resolve(process.cwd(), file);
    const content = JSON.parse(readFileSync(path, "utf8"));
    const cards = Array.isArray(content) ? content : [content];
    if (!cards.length) throw new Error(`${path}: the exported figure set is empty`);
    return cards.map((rawCard) => {
      const card = fitFigureToGrid(normalizeFigureGridNoise(rawCard));
      validateFigureCard(card);
      return { path, card };
    });
  });
  const ids = new Set();
  for (const { card } of corrected) {
    if (ids.has(card.id)) throw new Error(`The same figure was supplied twice: ${card.id}`);
    ids.add(card.id);
  }

  const topic = readTopic(TOPIC_PATH);
  const nextTopic = clone(topic);
  const changed = [];
  for (const { card } of corrected) {
    const index = nextTopic.cards.findIndex((item) => item.id === card.id);
    if (index < 0) {
      if (!addFigures) throw new Error(`${card.id}: the topic does not contain this figure (use --add for a new figure)`);
      const added = fitFigureToGrid(card);
      nextTopic.cards.push(added);
      changed.push(added);
      continue;
    }
    const merged = fitFigureToGrid(mergeFigureGeometry(nextTopic.cards[index], card));
    if (JSON.stringify(merged) !== JSON.stringify(nextTopic.cards[index])) {
      nextTopic.cards[index] = merged;
      changed.push(merged);
    }
  }
  if (!changed.length && !refreshRuntime) throw new Error("No geometry changes to deploy.");

  const catalogPath = resolve(ROOT, "public/decks/catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const catalogEntry = catalog.decks?.find((deck) => deck.id === topic.meta?.id);
  if (!catalogEntry || catalogEntry.version !== topic.meta?.version) throw new Error("Topic version and catalog version must match before deployment.");

  const nextVersion = nextPatchVersion(topic.meta.version);
  nextTopic.meta.version = nextVersion;
  const deckName = `symmetry_draw_v${nextVersion}.zip`;
  const deckPath = resolve(ROOT, "public/decks", deckName);
  if (existsSync(deckPath)) throw new Error(`Refusing to overwrite an existing deck: ${deckPath}`);
  const topicText = `${JSON.stringify(nextTopic, null, 2)}\n`;

  if (dryRun) {
    if (changed.length) console.log(`✓ validated ${changed.length} correction(s): ${changed.map((card) => card.id).join(", ")}`);
    if (refreshRuntime) console.log("✓ validated a deck runtime refresh");
    console.log(`  will publish local deck ${deckName} and update catalog ${topic.meta.version} → ${nextVersion}`);
  } else {
    const deckBuffer = await createSymmetryDrawDeckBuffer(topicText);
    writeFileSync(TOPIC_PATH, topicText);
    exportFigureJsons(nextTopic, FIGURES_DIR);
    buildFiguresGallery();
    writeFileSync(deckPath, deckBuffer);
    catalogEntry.version = nextVersion;
    catalogEntry.url = `./decks/${deckName}`;
    catalogEntry.zipUrl = deckName;
    writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    const changeDescription = changed.length
      ? `${changed.length} corrected figure JSON file(s)`
      : "a deck runtime refresh";
    console.log(`✓ deployed ${changeDescription} into symmetry_draw v${nextVersion}`);
    console.log(`  ${deckPath}`);
  }
}
