// Every deck the catalog points at must exist and carry the same version inside.
// Regression: commit 4094a279 bumped opposites to v2.13.1 in catalog.json without
// the ZIP, so every newcomer who picked the topic got "Deck file not found".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const DECKS_DIR = path.resolve("public/decks");
const catalog = JSON.parse(readFileSync(path.join(DECKS_DIR, "catalog.json"), "utf8"));

for (const deck of catalog.decks) {
  test(`catalog deck ${deck.id} v${deck.version}: ZIP exists and matches`, async () => {
    const file = path.resolve("public", deck.url);
    assert.ok(existsSync(file), `${deck.url} is missing`);
    assert.equal(path.basename(file), `${deck.id}_v${deck.version}.zip`, "file name must carry the catalog version");
    const zip = await JSZip.loadAsync(readFileSync(file));
    // Renderer topics ship topic.json; flashcard decks ship deck.json. Both carry meta.version.
    const manifest = zip.file("topic.json") ?? zip.file("deck.json");
    assert.ok(manifest, "ZIP has neither topic.json nor deck.json at its root");
    const meta = JSON.parse(await manifest.async("string")).meta;
    assert.equal(meta?.version, deck.version, "the manifest inside the ZIP must carry the catalog version");
  });
}
