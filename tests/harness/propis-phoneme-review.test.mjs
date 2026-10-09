import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { PROPIS_PHONEME_ENTRIES, phonemeInput } from "../../scripts/lib/propis-phoneme-bank.mjs";

test("propis trial contains 33 alphabet entries and two case words with phonetic consonants", () => {
  assert.equal(PROPIS_PHONEME_ENTRIES.length, 35);
  assert.equal(new Set(PROPIS_PHONEME_ENTRIES.map((entry) => entry.key)).size, 35);
  assert.equal(PROPIS_PHONEME_ENTRIES.filter((entry) => entry.phoneme).length, 31);
  assert.equal(PROPIS_PHONEME_ENTRIES.slice(0, 33).map((entry) => entry.letter).join(""), "абвгдеёжзийклмнопрстуфхцчшщъыьэюя");
  for (const [letter, phoneme] of [["к", "k"], ["с", "s"], ["щ", "S_j"], ["ч", "tS_j"]]) {
    const entry = PROPIS_PHONEME_ENTRIES.find((item) => item.letter === letter);
    assert.deepEqual(phonemeInput(entry), { ssml: `<speak><phoneme alphabet="x-sampa" ph="${phoneme}">${letter}</phoneme></speak>` });
  }
  assert.deepEqual(phonemeInput(PROPIS_PHONEME_ENTRIES.find((entry) => entry.letter === "ь")), { text: "мягкий знак" });
  assert.deepEqual(phonemeInput(PROPIS_PHONEME_ENTRIES.find((entry) => entry.key === "case_upper")), { text: "заглавная" });
});

test("all 35 phoneme candidates decode with audible content and appear in alphabet order", { timeout: 60_000 }, async () => {
  const manifest = JSON.parse(await readFile("public/audio-review-manifest.json", "utf8"));
  const playlist = manifest.playlists.find((entry) => entry.id === "audio/propis-phoneme-review");
  assert.deepEqual(playlist.items.map((entry) => entry.key), PROPIS_PHONEME_ENTRIES.map((entry) => entry.key));
  const sources = await Promise.all(playlist.items.map(async (entry) => ({ key: entry.key, data: (await readFile(`public/${entry.path}`)).toString("base64") })));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    const measured = await page.evaluate(async (sources) => {
      const context = new AudioContext();
      try {
        const results = [];
        for (const { key, data } of sources) {
          const bytes = Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
          const buffer = await context.decodeAudioData(bytes.buffer);
          const samples = buffer.getChannelData(0);
          const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
          results.push({ key, duration: buffer.duration, peak });
        }
        return results;
      } finally { await context.close(); }
    }, sources);
    for (const entry of measured) {
      assert.ok(entry.duration > 0.15 && entry.duration < 4, `${entry.key}: duration ${entry.duration}`);
      assert.ok(entry.peak > 0.02, `${entry.key}: silent recording`);
    }
  } finally { await browser.close(); }
});
