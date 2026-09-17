import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, readTopic } from "./figure-jsons.mjs";

const OUTPUT_PATH = resolve(ROOT, "tools/figure_capture/figures_gallery.html");
const DIRECTION = {
  up: { col: 0, row: -1 }, up_right: { col: 1, row: -1 }, right: { col: 1, row: 0 }, down_right: { col: 1, row: 1 },
  down: { col: 0, row: 1 }, down_left: { col: -1, row: 1 }, left: { col: -1, row: 0 }, up_left: { col: -1, row: -1 },
};

function commandsToPath(start, commands) {
  const points = [{ col: start.col, row: start.row }];
  for (const command of commands) {
    const vector = DIRECTION[command.direction];
    if (!vector) throw new Error(`Unknown direction in topic data: ${command.direction}`);
    const previous = points.at(-1);
    points.push({ col: previous.col + vector.col * command.cells, row: previous.row + vector.row * command.cells });
  }
  return points;
}

function shapeFromCard(card) {
  if (card.taskKind === "dictation" && card.start && Array.isArray(card.commands)) {
    return {
      id: card.id, label: card.label, kind: "dictation", columns: card.columns, rows: card.rows,
      paths: [commandsToPath(card.start, card.commands)], decorations: card.decorations ?? [], detail: `${card.commands.length} команд`,
    };
  }
  if ((card.taskKind === "mirror" || card.taskKind === "repeat") && (Array.isArray(card.sourcePaths) || Array.isArray(card.sourceDots))) {
    const repeat = card.taskKind === "repeat";
    const paths = card.sourcePaths ?? [];
    const dots = card.sourceDots ?? [];
    const detail = [
      paths.length ? `${paths.length} ${paths.length === 1 ? "штрих" : "штрихов"}` : "",
      dots.length ? `${dots.length} ${dots.length === 1 ? "точка" : "точек"}` : "",
    ].filter(Boolean).join(" · ");
    return {
      id: card.id, label: card.label, kind: card.taskKind,
      columns: repeat ? card.axisCol : card.columns, rows: card.rows, axisCol: card.axisCol,
      paths, dots, decorations: [], detail,
    };
  }
  return null;
}

export function buildFiguresGallery() {
  const topic = readTopic();
  const figures = topic.cards.map(shapeFromCard).filter(Boolean);
  const data = JSON.stringify(figures).replace(/</g, "\\u003c");
  const html = readFileSync(OUTPUT_PATH, "utf8");
  const dataBlock = /const figures = [\s\S]*?;\r?\n    const LABELS/;
  if (!dataBlock.test(html)) throw new Error("Could not locate gallery data block");
  const next = html.replace(dataBlock, `const figures = ${data};\n    const LABELS`);
  writeFileSync(OUTPUT_PATH, next);
  console.log(`✓ figures gallery: ${figures.length} figures -> ${OUTPUT_PATH}`);
  return { count: figures.length, output: OUTPUT_PATH };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) buildFiguresGallery();
