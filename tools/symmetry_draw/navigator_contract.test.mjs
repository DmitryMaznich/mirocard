import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const renderer = await readFile(new URL("./renderer.js", import.meta.url), "utf8");
const sessionScreen = await readFile(new URL("../../src/features/session/SessionScreen.jsx", import.meta.url), "utf8");
const paramsScreen = await readFile(new URL("../../src/features/session/ParamsScreen.jsx", import.meta.url), "utf8");
const topic = JSON.parse(await readFile(new URL("./topic.json", import.meta.url), "utf8"));
const vectors = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
  up_left: [-1, -1], up_right: [1, -1], down_left: [-1, 1], down_right: [1, 1],
};

test("the bundled drawing renderer is valid JavaScript", () => {
  assert.doesNotThrow(() => new Function(renderer));
});

test("listening navigator shows the command if speech synthesis is unavailable", () => {
  assert.match(renderer, /const usesAuditoryPrompt = isListening && canSpeak;/);
  assert.match(renderer, /usesAuditoryPrompt\s*\? h\("button"/);
  assert.match(renderer, /Озвучка недоступна — команда показана текстом/);
});

test("navigator keeps a wrong-answer trace visible before retrying the task", () => {
  const feedbackStart = renderer.indexOf('setResult("miss")');
  const retryStart = renderer.indexOf("onMistake?.(task.conceptId, task.card?.id)");
  assert.ok(feedbackStart >= 0, "wrong result is rendered");
  assert.ok(retryStart > feedbackStart, "retry is reported after feedback is rendered");
  assert.match(renderer, /window\.setTimeout\([\s\S]{0,220}onMistake\?\.\(task\.conceptId, task\.card\?\.id\)[\s\S]{0,80}\}, 520\)/);
});

test("learning flash cards start predictably and choice exercises retain four cardinal directions", () => {
  assert.match(renderer, /const BASIC_NAVIGATOR_DIRECTIONS = \["up", "right", "down", "left"\];/);
  assert.match(renderer, /const \[index, setIndex\] = useState\(0\);/);
});

test("a dictation error preserves the completed part of the drawing", () => {
  assert.match(sessionScreen, /const keepsDictationCanvasOnMistake = topicRecord\.meta\.id === "symmetry_draw"/);
  assert.match(sessionScreen, /\["graphic_dictation", "coordinate_dictation"\]\.includes\(currentTask\?\.type\)/);
  assert.match(sessionScreen, /const rendererTaskKey = keepsDictationCanvasOnMistake\s*\? String\(taskIndex\)\s*:/);
});

test("every figure-building mode has a complete three-level card pool", () => {
  for (const taskKind of ["mirror", "repeat", "dictation", "coordinate"]) {
    const cards = topic.cards.filter((card) => card.taskKind === taskKind);
    assert.ok(cards.length > 0, `${taskKind} has cards`);
    for (const difficulty of ["starter", "reinforce", "challenge"]) {
      assert.ok(cards.filter((card) => card.difficulty === difficulty).length >= 6, `${taskKind}/${difficulty} has at least six figures`);
    }
  }
});

test("worksheet references add the complete complex repeat figure set", () => {
  const ids = ["repeat_duck_worksheet", "repeat_seahorse_worksheet", "repeat_crocodile_worksheet", "repeat_cactus_worksheet", "repeat_person_worksheet", "repeat_squirrel_worksheet", "repeat_elephant_worksheet", "repeat_bull_worksheet"];
  for (const id of ids) {
    const card = topic.cards.find((item) => item.id === id);
    assert.equal(card?.taskKind, "repeat", `${id} is a repeat card`);
    assert.equal(card?.difficulty, "challenge", `${id} stays in the advanced pool`);
    assert.ok(card.sourcePaths.flat().length >= 6, `${id} contains a drawable trace`);
  }
  assert.equal(topic.cards.find((card) => card.id === "repeat_seahorse_worksheet")?.label, "Утка с хвостом");
});

test("the figure difficulty control is shown in every specialized drawing settings screen", () => {
  assert.match(paramsScreen, /function FigureDifficultyParam/);
  assert.equal((paramsScreen.match(/<FigureDifficultyParam\b/g) ?? []).length, 2);
  assert.match(paramsScreen, /<SymmetryDrawPrintParams topicRecord=\{topicRecord\} mode=\{mode\} params=\{params\} \/>/);
  assert.match(paramsScreen, /figureCountLabel\(count\)/);
  assert.match(paramsScreen, /figure-difficulty-option__count/);
  assert.match(paramsScreen, /getFigureDifficultyRecommendation/);
});

test("all figure geometry stays inside its printable grid", () => {
  for (const card of topic.cards) {
    if (card.taskKind === "repeat") {
      for (const point of card.sourcePaths.flat()) {
        assert.ok(point.col >= 0 && point.col <= card.axisCol && point.row >= 0 && point.row <= card.rows, `${card.id} repeat point is in bounds`);
      }
    }
    if (card.taskKind === "coordinate") {
      for (const point of card.points) {
        assert.ok(point.col >= 0 && point.col <= card.columns && point.row >= 0 && point.row <= card.rows, `${card.id} coordinate is in bounds`);
      }
    }
    if (card.taskKind === "dictation") {
      let point = { ...card.start };
      for (const command of card.commands) {
        const vector = vectors[command.direction];
        assert.ok(vector, `${card.id} has a supported direction`);
        point = { col: point.col + vector[0] * command.cells, row: point.row + vector[1] * command.cells };
        assert.ok(point.col >= 0 && point.col <= card.columns && point.row >= 0 && point.row <= card.rows, `${card.id} command endpoint is in bounds`);
      }
    }
  }
});
