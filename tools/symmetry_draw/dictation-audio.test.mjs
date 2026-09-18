import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  collectDictationAudioEntries,
  coordinateAudioPath,
  coordinateCommandText,
  directionAudioPath,
  directionCommandText,
} from "./dictation-audio.mjs";

const topic = JSON.parse(await readFile(new URL("./topic.json", import.meta.url), "utf8"));
const renderer = await readFile(new URL("./renderer.js", import.meta.url), "utf8");

test("dictation audio names are safe and phrases stay child-readable", () => {
  assert.equal(directionCommandText({ direction: "right", cells: 2 }), "2 клетки вправо");
  assert.equal(directionAudioPath({ direction: "right", cells: 2 }), "audio/dictation/directions/right_2.mp3");
  assert.equal(coordinateCommandText({ col: 0, row: 2 }), "Точка А, 3");
  assert.equal(coordinateAudioPath({ col: 0, row: 2 }), "audio/dictation/coordinates/0_3.mp3");
});

test("every available graphic-dictation command has one recording target", () => {
  const entries = collectDictationAudioEntries(topic);
  assert.equal(entries.length, 140);
  assert.equal(new Set(entries.map((entry) => entry.path)).size, entries.length);
  assert.ok(entries.every((entry) => entry.path.endsWith(".mp3") && entry.text.length > 0));
});

test("dictation uses deck recordings and can hide the written command", () => {
  const start = renderer.indexOf("function DictationTask");
  const end = renderer.indexOf("function CoordinatePracticeTask");
  const dictation = renderer.slice(start, end);
  assert.match(dictation, /dictationPresentation/);
  assert.match(dictation, /playTopicFile\(topicId, commandAudioPath\)/);
  assert.match(dictation, /isVoiceOnly/);
  assert.doesNotMatch(dictation, /speechSynthesis|SpeechSynthesisUtterance/);
  const mode = topic.modes.find((item) => item.type === "graphic_dictation");
  assert.deepEqual(mode?.params?.dictationPresentation?.values, ["text_graphics_voice", "voice"]);
});
