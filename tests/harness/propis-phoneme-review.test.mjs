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
  assert.equal(PROPIS_PHONEME_ENTRIES.filter((entry) => entry.clip).length, 21);
  for (const letter of ["к", "с", "щ", "ч"]) {
    const entry = PROPIS_PHONEME_ENTRIES.find((item) => item.letter === letter);
    assert.deepEqual(phonemeInput(entry), { text: `${letter}а` });
    assert.ok(entry.clip[1] > entry.clip[0]);
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
          let longestVoicedRun = 0;
          if (["sound_к", "sound_с", "sound_щ"].includes(key)) {
            // A sustained periodic vowel exposed the original SSML fallback.
            const window = Math.round(buffer.sampleRate * 0.03);
            const step = Math.round(buffer.sampleRate * 0.015);
            let run = 0;
            for (let start = 0; start + window < samples.length; start += step) {
              let energy = 0;
              for (let i = 0; i < window; i++) energy += samples[start + i] ** 2;
              let correlation = 0;
              if (Math.sqrt(energy / window) > 0.005) {
                for (let lag = Math.floor(buffer.sampleRate / 400); lag < buffer.sampleRate / 130; lag++) {
                  let xy = 0, xx = 0, yy = 0;
                  for (let i = 0; i < window - lag; i++) {
                    const x = samples[start + i], y = samples[start + i + lag];
                    xy += x * y; xx += x * x; yy += y * y;
                  }
                  correlation = Math.max(correlation, xy / Math.sqrt(xx * yy));
                }
              }
              run = correlation > 0.8 ? run + 0.015 : 0;
              longestVoicedRun = Math.max(longestVoicedRun, run);
            }
          }
          results.push({ key, duration: buffer.duration, peak, longestVoicedRun });
        }
        return results;
      } finally { await context.close(); }
    }, sources);
    for (const entry of measured) {
      assert.ok(entry.duration > 0.15 && entry.duration < 4, `${entry.key}: duration ${entry.duration}`);
      assert.ok(entry.peak > 0.02, `${entry.key}: silent recording`);
      assert.ok(entry.longestVoicedRun < 0.045, `${entry.key}: sustained voiced vowel in an unvoiced consonant`);
    }
  } finally { await browser.close(); }
});
