import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import JSZip from "jszip";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { openDb, kv } from "@/core/db";
import InfoModal from "@/shared/components/InfoModal";
import { getTopicRecord, importTopic, listTopicRecords } from "./topicLoader";
import { RELEASE_TOPIC_COPY } from "./releaseTopicCopy";

const catalog = JSON.parse(await readFile(resolve("public/decks/catalog.json"), "utf8"));
const releaseDecks = catalog.decks.filter((deck) => deck.status === "release");

async function install(deck) {
  const db = await openDb(`release-copy-${deck.id}-${Math.random()}`);
  const bytes = await readFile(resolve("public/decks", basename(deck.url)));
  const record = await importTopic(db, bytes, "99.0.0");
  return { db, record };
}

describe("release topic copy", () => {
  it("covers every shipped mode with a concrete description and goal", async () => {
    expect(releaseDecks).toHaveLength(14);
    for (const deck of releaseDecks) {
      const { record } = await install(deck);
      expect(record.meta.about.description.length, deck.id).toBeGreaterThan(45);
      expect(record.meta.about.finalGoal.length, deck.id).toBeGreaterThan(30);
      expect(record.meta.about.goals.length, deck.id).toBeGreaterThan(0);
      expect(record.modes.length, deck.id).toBeGreaterThan(0);
      for (const mode of record.modes) {
        expect(mode.methodology?.summary?.length, `${deck.id}/${mode.id} summary`).toBeGreaterThan(20);
        expect(mode.methodology?.text?.length, `${deck.id}/${mode.id} text`).toBeGreaterThan(20);
        expect(mode.methodology?.goal?.length, `${deck.id}/${mode.id} goal`).toBeGreaterThan(20);
        expect(mode.methodology.goal, `${deck.id}/${mode.id}`).not.toContain("переносит навык в занятие");
      }
    }
  }, 30000);

  it("does not leak unrelated reading modes into Instructions", async () => {
    const deck = releaseDecks.find((item) => item.id === "reading_dad_instructions");
    const { record } = await install(deck);
    expect(record.modes.map((mode) => mode.id).sort()).toEqual([
      "daily_sentences",
      "daily_sentences_spatial",
      "safe_code",
    ].sort());
  });

  it("refreshes old installed copy on both single and list reads", async () => {
    const deck = releaseDecks.find((item) => item.id === "addition_subtraction");
    const { db } = await install(deck);
    const saved = await kv.get(db, `topic:${deck.id}`);
    saved.meta.about.description = "Старое описание";
    saved.modes.find((mode) => mode.id === "operation_audio").methodology.goal = "Старая цель";
    await kv.set(db, `topic:${deck.id}`, saved);

    const current = await getTopicRecord(db, deck.id);
    const listed = (await listTopicRecords(db)).find((record) => record.meta.id === deck.id);
    for (const record of [current, listed]) {
      expect(record.meta.about.description).toBe(RELEASE_TOPIC_COPY[deck.id].about.description);
      expect(record.modes.find((mode) => mode.id === "operation_audio").methodology.goal)
        .toBe(RELEASE_TOPIC_COPY[deck.id].modes.operation_audio.goal);
    }
  });

  it("keeps authored legacy about lines instead of replacing them with renderer boilerplate", async () => {
    const zip = new JSZip();
    zip.file("topic.json", JSON.stringify({
      meta: {
        id: "legacy_reading_copy_test",
        version: "1.0.0",
        renderer: "reading",
        title: "Test",
        about: { ru: ["Описание конкретного рассказа.", "Читайте его вместе."] },
      },
      modes: [],
      cards: [],
      texts: [{ id: "story", kind: "story", lines: [{ id: "line", text: "Текст." }] }],
    }));
    const db = await openDb(`legacy-about-${Math.random()}`);
    const record = await importTopic(db, await zip.generateAsync({ type: "arraybuffer" }), "99.0.0");
    expect(record.meta.about.description).toBe("Описание конкретного рассказа.");
    expect(record.meta.about.flow).toEqual(["Читайте его вместе."]);
    expect(record.meta.about.goals).toEqual([]);
    expect(record.meta.about.finalGoal).toBe("");
  });

  it("removes leaked reading defaults from a previously installed Instructions record", async () => {
    const deck = releaseDecks.find((item) => item.id === "reading_dad_instructions");
    const { db } = await install(deck);
    const saved = await kv.get(db, `topic:${deck.id}`);
    saved.meta.excludeDefaultModes = [];
    saved.modes.push({ id: "read_poem_book", type: "read_poem_book", ui: { title: "Педагогические стихи" } });
    await kv.set(db, `topic:${deck.id}`, saved);
    expect((await getTopicRecord(db, deck.id)).modes.map((mode) => mode.id).sort())
      .toEqual(["daily_sentences", "daily_sentences_spatial", "safe_code"].sort());
  });

  it("ships the same editorial copy inside each revised ZIP", async () => {
    for (const deck of releaseDecks.filter((item) => RELEASE_TOPIC_COPY[item.id])) {
      const zip = await JSZip.loadAsync(await readFile(resolve("public/decks", basename(deck.url))));
      const manifestFile = zip.file("topic.json") ?? zip.file("deck.json");
      const manifest = JSON.parse(await manifestFile.async("string"));
      const copy = RELEASE_TOPIC_COPY[deck.id];
      expect(manifest.meta.about.description, deck.id).toBe(copy.about.description);
      expect(manifest.meta.copyHash, deck.id).toMatch(/^[a-f0-9]{16}$/);
      for (const [modeId, editorial] of Object.entries(copy.modes ?? {})) {
        const mode = manifest.modes.find((item) => item.id === modeId);
        // safe_code is the only code-owned default mode, added on import.
        if (modeId === "safe_code") continue;
        expect(mode?.methodology?.goal, `${deck.id}/${modeId}`).toBe(editorial.goal);
      }
    }
  });

  it("shows installed topic and mode copy in the real information modal", async () => {
    const deck = releaseDecks.find((item) => item.id === "word_formation_soup");
    const { record } = await install(deck);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      act(() => root.render(createElement(InfoModal, {
        title: "Словообразование",
        about: record.meta.about,
        modes: record.modes,
        onClose: () => {},
      })));
      const visible = container.textContent;
      expect(visible).toContain("суп из рыбы — рыбный суп");
      expect(visible).toContain("Знакомство с парами");
      expect(visible).toContain("Согласование прилагательных");
      expect(visible).toContain("Цель: Ребёнок согласует знакомое прилагательное с существительным по роду и числу");
      expect(visible).not.toContain("переносит навык в занятие");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

});
