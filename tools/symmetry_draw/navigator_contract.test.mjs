import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const renderer = await readFile(new URL("./renderer.js", import.meta.url), "utf8");
const sessionScreen = await readFile(new URL("../../src/features/session/SessionScreen.jsx", import.meta.url), "utf8");

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
