import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createSymmetryDrawDeckBuffer } from "./build.mjs";
import JSZip from "jszip";
import {
  collectDictationAudioEntries,
  coordinateAudioPaths,
  coordinateLetterAudioPath,
  coordinateNumberAudioPath,
  coordinateCommandText,
  cellsAudioPath,
  directionAudioPaths,
  directionCommandText,
} from "./dictation-audio.mjs";

const topic = JSON.parse(await readFile(new URL("./topic.json", import.meta.url), "utf8"));
const renderer = await readFile(new URL("./renderer.js", import.meta.url), "utf8");

test("the built deck carries every coordinate and navigator recording", async () => {
  const zip = await JSZip.loadAsync(await createSymmetryDrawDeckBuffer());
  const paths = [
    ...Array.from({ length: 20 }, (_, index) => coordinateLetterAudioPath(index)),
    ...Array.from({ length: 20 }, (_, index) => coordinateNumberAudioPath(index + 1)),
    ...Array.from({ length: 20 }, (_, index) => cellsAudioPath(index + 1)),
    ...["up", "down", "right", "left", "up_right", "down_right", "up_left", "down_left"].flatMap((direction) => [
      `audio/navigator/${direction}.mp3`,
      `audio/dictation/directions/${direction}.mp3`,
    ]),
  ];
  for (const path of paths) {
    assert.deepEqual(await zip.file(path)?.async("nodebuffer"), await readFile(new URL(`./${path}`, import.meta.url)), path);
  }
  assert.match(renderer, /"audio\/navigator\/" \+ navigatorDirection \+ "\.mp3"/);
});

test("dictation audio names are safe and phrases stay child-readable", () => {
  assert.equal(directionCommandText({ direction: "right", cells: 2 }), "2 клетки вправо");
  assert.deepEqual(directionAudioPaths({ direction: "right", cells: 2 }), [
    "audio/dictation/cells/2.mp3",
    "audio/dictation/directions/right.mp3",
  ]);
  assert.throws(() => directionAudioPaths({ direction: "right", cells: 21 }), /must not exceed 20/);
  assert.match(renderer, /`audio\/dictation\/cells\/\$\{command\.cells\}\.mp3`,\s*`audio\/dictation\/directions\/\$\{command\.direction\}\.mp3`/);
  assert.equal(coordinateCommandText({ col: 0, row: 2 }), "Точка А, 3");
  assert.deepEqual(coordinateAudioPaths({ col: 0, row: 2 }), [
    "audio/dictation/coordinate_letters/0.mp3",
    "audio/dictation/coordinate_numbers/3.mp3",
  ]);
});

test("every dictation command is voiced by a committed cells + direction pair", async () => {
  for (const card of topic.cards.filter((entry) => entry.taskKind === "dictation")) {
    for (const command of card.commands) {
      for (const path of directionAudioPaths(command)) await readFile(new URL(`./${path}`, import.meta.url));
    }
  }
});

test("the coordinate dictation reuses letter and number recordings", () => {
  const entries = collectDictationAudioEntries(topic);
  assert.equal(new Set(entries.map((entry) => entry.path)).size, entries.length);
  assert.ok(entries.every((entry) => entry.path.endsWith(".mp3") && entry.text.length > 0));

  const coordinates = entries.filter((entry) => entry.path.includes("/coordinate_"));
  const coordinateCards = topic.cards.filter((card) => card.taskKind === "coordinate");
  const columns = new Set(coordinateCards.flatMap((card) => card.points.map((point) => point.col)));
  const rows = new Set(coordinateCards.flatMap((card) => card.points.map((point) => point.row + 1)));

  assert.equal(coordinates.length, columns.size + rows.size);
  assert.ok(coordinates.length <= 40, "a 20-column, 20-row grid needs at most 40 coordinate recordings");
  assert.equal(entries.some((entry) => /coordinates\/\d+_\d+\.mp3$/.test(entry.path)), false);
  assert.throws(() => coordinateLetterAudioPath(20), /Invalid dictation coordinate column/);
  assert.throws(() => coordinateNumberAudioPath(21), /must not exceed 20/);
});

test("removed graphic-dictation figures are absent in both command modes", () => {
  const removedIds = new Set([
    "dictation_boat_small",
    "dictation_flower",
    "dictation_small_plane",
    "dictation_small_fish",
    "coordinate_boat_small",
    "coordinate_flower",
    "coordinate_small_plane",
    "coordinate_small_fish",
  ]);

  const retainedIds = new Set(topic.cards.map((card) => card.id));
  for (const id of removedIds) {
    assert.equal(retainedIds.has(id), false, `${id} must not be selectable`);
  }
});

test("dictation uses deck recordings and has independent text, arrow and voice settings", () => {
  const start = renderer.indexOf("function DictationTask");
  const end = renderer.indexOf("function CoordinatePracticeTask");
  const dictation = renderer.slice(start, end);
  assert.match(dictation, /showCommandText/);
  assert.match(dictation, /showArrow/);
  assert.match(dictation, /playCommandVoice/);
  assert.match(renderer, /coordinateAudioPaths\(point\)/);
  assert.match(dictation, /playTopicFiles\(topicId, commandAudioPaths\)/);
  assert.match(dictation, /isTopicAudioPlaying/);
  assert.match(dictation, /h\(SpeakerGlyph,/);
  assert.match(dictation, /isVoiceOnly/);
  assert.doesNotMatch(dictation, /dictationPresentation/);
  assert.doesNotMatch(dictation, /setTimeout\(playInstruction/);
  assert.doesNotMatch(dictation, /speechSynthesis|SpeechSynthesisUtterance/);
  const mode = topic.modes.find((item) => item.type === "graphic_dictation");
  assert.equal(mode?.params?.showCommandText?.default, true);
  assert.equal(mode?.params?.showArrow?.default, true);
  assert.equal(mode?.params?.playCommandVoice?.default, true);
  assert.equal(mode?.params?.dictationPresentation, undefined);
});
