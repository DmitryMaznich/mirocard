import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TOPIC_PATH = resolve(ROOT, "tools/symmetry_draw/topic.json");
export const FIGURES_DIR = resolve(ROOT, "tools/symmetry_draw/figures");
export const FIGURE_TASK_KINDS = new Set(["mirror", "repeat", "dictation"]);

const DIRECTION = new Set(["up", "up_right", "right", "down_right", "down", "down_left", "left", "up_left"]);

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function isFigureCard(card) {
  return Boolean(card && FIGURE_TASK_KINDS.has(card.taskKind));
}

export function readTopic(topicPath = TOPIC_PATH) {
  return JSON.parse(readFileSync(topicPath, "utf8"));
}

export function figureCards(topic) {
  return (topic.cards ?? []).filter(isFigureCard);
}

export function figureFilePath(id, outputDir = FIGURES_DIR) {
  return resolve(outputDir, `${id}.json`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isGridPoint(point) {
  return Boolean(point && Number.isFinite(point.col) && Number.isFinite(point.row));
}

function assertGridSize(card) {
  assert(Number.isInteger(card.columns) && card.columns >= 2, `${card.id}: columns must be an integer of at least 2`);
  assert(Number.isInteger(card.rows) && card.rows >= 2, `${card.id}: rows must be an integer of at least 2`);
}

function assertSourceGeometry(card) {
  assert(Number.isInteger(card.axisCol) && card.axisCol >= 1 && card.axisCol * 2 === card.columns, `${card.id}: axisCol must split the grid in half`);
  const paths = card.sourcePaths ?? [];
  const dots = card.sourceDots ?? [];
  const circles = card.sourceCircles ?? [];
  assert(Array.isArray(paths), `${card.id}: sourcePaths must be an array`);
  assert(Array.isArray(dots), `${card.id}: sourceDots must be an array`);
  assert(Array.isArray(circles), `${card.id}: sourceCircles must be an array`);
  assert(paths.length || dots.length || circles.length, `${card.id}: sourcePaths, sourceDots or sourceCircles is required`);
  for (const [pathIndex, path] of paths.entries()) {
    assert(Array.isArray(path) && path.length >= 2, `${card.id}: path ${pathIndex + 1} needs at least two points`);
    for (const [pointIndex, point] of path.entries()) {
      assert(isGridPoint(point), `${card.id}: point ${pathIndex + 1}.${pointIndex + 1} is invalid`);
      assert(point.col >= 0 && point.col <= card.axisCol && point.row >= 0 && point.row <= card.rows, `${card.id}: point ${pathIndex + 1}.${pointIndex + 1} is outside the source grid`);
    }
  }
  for (const [pointIndex, point] of dots.entries()) {
    assert(isGridPoint(point), `${card.id}: source dot ${pointIndex + 1} is invalid`);
    assert(point.col >= 0 && point.col <= card.axisCol && point.row >= 0 && point.row <= card.rows, `${card.id}: source dot ${pointIndex + 1} is outside the source grid`);
  }
  for (const [circleIndex, circle] of circles.entries()) {
    assert(isGridPoint(circle), `${card.id}: source circle ${circleIndex + 1} has an invalid center`);
    assert(Number.isFinite(circle.diameter) && circle.diameter > 0, `${card.id}: source circle ${circleIndex + 1} needs a positive diameter`);
    const radius = circle.diameter / 2;
    assert(circle.col - radius >= 0 && circle.col + radius <= card.axisCol && circle.row - radius >= 0 && circle.row + radius <= card.rows, `${card.id}: source circle ${circleIndex + 1} is outside the source grid`);
  }
}

function assertDictation(card) {
  assert(isGridPoint(card.start), `${card.id}: start is required`);
  assert(card.start.col >= 0 && card.start.col <= card.columns && card.start.row >= 0 && card.start.row <= card.rows, `${card.id}: start is outside the grid`);
  assert(Array.isArray(card.commands) && card.commands.length, `${card.id}: commands is required`);
  let current = card.start;
  for (const [index, command] of card.commands.entries()) {
    assert(DIRECTION.has(command?.direction), `${card.id}: command ${index + 1} has an unknown direction`);
    assert(Number.isInteger(command?.cells) && command.cells >= 1, `${card.id}: command ${index + 1} needs a positive integer cell count`);
    const vector = {
      up: [0, -1], up_right: [1, -1], right: [1, 0], down_right: [1, 1],
      down: [0, 1], down_left: [-1, 1], left: [-1, 0], up_left: [-1, -1],
    }[command.direction];
    current = { col: current.col + vector[0] * command.cells, row: current.row + vector[1] * command.cells };
    assert(current.col >= 0 && current.col <= card.columns && current.row >= 0 && current.row <= card.rows, `${card.id}: command ${index + 1} leaves the grid`);
  }
}

export function validateFigureCard(card) {
  assert(card && typeof card === "object", "Figure JSON must be an object");
  assert(typeof card.id === "string" && /^[a-z0-9][a-z0-9_-]*$/.test(card.id), "Figure JSON has an invalid id");
  assert(isFigureCard(card), `${card.id}: unsupported taskKind`);
  assert(typeof card.label === "string" && card.label.trim(), `${card.id}: label is required`);
  assertGridSize(card);
  if (card.taskKind === "dictation") assertDictation(card);
  else assertSourceGeometry(card);
  return card;
}

export function exportFigureJsons(topic = readTopic(), outputDir = FIGURES_DIR) {
  const cards = figureCards(topic);
  mkdirSync(outputDir, { recursive: true });
  for (const card of cards) {
    validateFigureCard(card);
    writeFileSync(figureFilePath(card.id, outputDir), `${JSON.stringify(card, null, 2)}\n`);
  }
  const manifest = {
    schema: "mirocard-figure-manifest/v1",
    topicId: topic.meta?.id,
    topicVersion: topic.meta?.version,
    figures: cards.map((card) => ({ id: card.id, label: card.label, taskKind: card.taskKind, file: `${card.id}.json` })),
  };
  writeFileSync(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { count: cards.length, outputDir };
}

export function mergeFigureGeometry(current, corrected) {
  validateFigureCard(corrected);
  assert(current?.id === corrected.id, `${corrected.id}: no matching card in the topic`);
  assert(current.taskKind === corrected.taskKind, `${corrected.id}: taskKind cannot change during geometry correction`);
  const merged = { ...current, label: corrected.label, columns: corrected.columns, rows: corrected.rows };
  if (corrected.taskKind === "dictation") {
    merged.start = clone(corrected.start);
    merged.commands = clone(corrected.commands);
  } else {
    merged.axisCol = corrected.axisCol;
    if (corrected.sourcePaths?.length) merged.sourcePaths = clone(corrected.sourcePaths);
    else delete merged.sourcePaths;
    if (corrected.sourceDots?.length) merged.sourceDots = clone(corrected.sourceDots);
    else delete merged.sourceDots;
    if (corrected.sourceCircles?.length) merged.sourceCircles = clone(corrected.sourceCircles);
    else delete merged.sourceCircles;
  }
  validateFigureCard(merged);
  return merged;
}

export function nextPatchVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  if (!match) throw new Error(`Cannot patch invalid version: ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}
