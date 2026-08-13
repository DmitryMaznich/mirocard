import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { commandsToPath } from "./verify_trace.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const topicPath = join(dir, "topic.json");
const topic = JSON.parse(readFileSync(topicPath, "utf8"));

// Coordinate cards are found by tapping a labeled point directly, not by
// following a drawn path - a grid fine enough for a traced animal outline
// (20-30+ columns) makes every cell too small to tap reliably and runs past
// the 31-letter column-label alphabet. Cap at the size the simple geometric
// dictation cards already fit in.
const MAX_COORDINATE_DIMENSION = 12;

const dictationCards = topic.cards.filter(
  (card) => card.taskKind === "dictation" && card.columns <= MAX_COORDINATE_DIMENSION && card.rows <= MAX_COORDINATE_DIMENSION,
);

const coordinateCards = dictationCards.map((card) => {
  const path = commandsToPath(card.start, card.commands);
  const points = path.slice(1); // drop the leading point, which duplicates `start`
  const id = card.id.replace(/^dictation_/, "coordinate_");
  return {
    id,
    conceptId: id,
    primary: true,
    label: card.label,
    taskKind: "coordinate",
    columns: card.columns,
    rows: card.rows,
    start: card.start,
    points,
  };
});

const existingIds = new Set(topic.cards.map((card) => card.id));
const newCards = coordinateCards.filter((card) => !existingIds.has(card.id));
if (newCards.length !== coordinateCards.length) {
  console.log(`Skipped ${coordinateCards.length - newCards.length} card(s) that already exist.`);
}

topic.cards.push(...newCards);
writeFileSync(topicPath, `${JSON.stringify(topic, null, 2)}\n`, "utf8");
console.log(`Added ${newCards.length} coordinate card(s) to ${topicPath}`);
