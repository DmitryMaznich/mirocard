import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import BilingualWordsRenderer from "./index.jsx";

const card = (conceptId, sl, ru, group = "malica") => ({
  id: `${conceptId}_1`,
  conceptId,
  imageUrl: "data:image/webp;base64,AA==",
  word: { sl, ru },
  audio: { sl: `audio/sl/${conceptId}.mp3`, ru: `audio/ru/${conceptId}.mp3` },
  group,
});
const VODA = card("voda", "voda", "вода");
const ZOGA = card("zoga", "žoga", "мяч", "igrisce");

function findTask(audioOrder) {
  return {
    type: "bw_find",
    conceptId: "voda",
    card: VODA,
    audioOrder,
    promptDelaySec: 5,
    options: [{ card: ZOGA, isTarget: false }, { card: VODA, isTarget: true }],
  };
}

describe("bilingual_words renderer", () => {
  let container;
  let root;
  let played;
  let props;

  beforeEach(() => {
    vi.useFakeTimers();
    played = [];
    props = {
      topicId: "learn_slovene",
      playTopicFile: vi.fn(async (_topic, path) => { played.push(path); return true; }),
      onCorrect: vi.fn(),
      onStreakReset: vi.fn(),
      onAdvance: vi.fn(),
    };
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    root = null;
    container = null;
    vi.useRealTimers();
  });

  async function mount(task) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root.render(<BilingualWordsRenderer task={task} {...props} />); });
  }
  const wait = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  const tap = (el) => act(async () => { el.click(); });
  const option = (sl) => container.querySelector(`.bw-opt[aria-label="${sl}"]`);
  const tile = (side) => container.querySelector(`.bw-tile--${side}`);

  it("«Показ пары»: home first, then school; the picture moves on only after the pair", async () => {
    await mount({ type: "bw_pair", conceptId: "voda", card: VODA });
    expect(tile("home").className).toContain("bw-tile--speaking");
    await tap(container.querySelector(".bw-opt"));
    expect(props.onAdvance).not.toHaveBeenCalled();
    await wait(3000);
    expect(played).toEqual(["audio/ru/voda.mp3", "audio/sl/voda.mp3"]);
    await tap(container.querySelector(".bw-opt"));
    expect(props.onAdvance).toHaveBeenCalledTimes(1);
  });

  it("step 2 plays Russian then Slovenian before the choice", async () => {
    await mount(findTask("ru_sl"));
    await wait(2000);
    expect(played).toEqual(["audio/ru/voda.mp3", "audio/sl/voda.mp3"]);
    expect(tile("home").className).not.toContain("bw-tile--hint");
  });

  it("a right answer alone: the pair sounds, then a plain correct", async () => {
    await mount(findTask("sl"));
    await wait(700);
    expect(played).toEqual(["audio/sl/voda.mp3"]);
    expect(tile("home").className).toContain("bw-tile--hint");
    await tap(option("voda"));
    expect(option("voda").className).toContain("bw-opt--correct");
    await wait(3000);
    expect(played.slice(1)).toEqual(["audio/sl/voda.mp3", "audio/ru/voda.mp3"]);
    expect(props.onCorrect).toHaveBeenCalledWith("voda", "voda_1", undefined);
  });

  it("prompts escalate: repeat → Russian → highlight; then the answer is assisted", async () => {
    await mount(findTask("sl"));
    await wait(700);
    await wait(5700);
    expect(played).toEqual(["audio/sl/voda.mp3", "audio/sl/voda.mp3"]);
    await wait(5700);
    expect(played[2]).toBe("audio/ru/voda.mp3");
    await wait(5700);
    expect(option("voda").className).toContain("bw-opt--hint");
    expect(option("žoga").className).toContain("bw-opt--faded");
    await tap(option("voda"));
    await wait(3000);
    expect(props.onCorrect).toHaveBeenCalledWith("voda", "voda_1", { assisted: true });
  });

  it("a repeat alone still counts as answered alone", async () => {
    await mount(findTask("sl"));
    await wait(700 + 5700);
    await tap(option("voda"));
    await wait(3000);
    expect(props.onCorrect).toHaveBeenCalledWith("voda", "voda_1", undefined);
  });

  it("a wrong tap: no advance, the answer is shown with the pair, then assisted", async () => {
    await mount(findTask("sl"));
    await wait(700);
    await tap(option("žoga"));
    expect(props.onStreakReset).toHaveBeenCalledWith("voda", "zoga_1");
    expect(props.onCorrect).not.toHaveBeenCalled();
    expect(option("žoga").className).toContain("bw-opt--faded");
    expect(option("voda").className).toContain("bw-opt--hint");
    await wait(3000);
    expect(played.slice(1)).toEqual(["audio/sl/voda.mp3", "audio/ru/voda.mp3"]);
    await tap(option("žoga"));
    expect(props.onStreakReset).toHaveBeenCalledTimes(1);
    await tap(option("voda"));
    await wait(3000);
    expect(props.onCorrect).toHaveBeenCalledWith("voda", "voda_1", { assisted: true });
  });

  it("asking home for the Russian word counts as help", async () => {
    await mount(findTask("sl"));
    await wait(700);
    await tap(tile("home"));
    await wait(700);
    expect(played[1]).toBe("audio/ru/voda.mp3");
    await tap(option("voda"));
    await wait(3000);
    expect(props.onCorrect).toHaveBeenCalledWith("voda", "voda_1", { assisted: true });
  });

  it("«Прослушать все слова» plays each language on its button", async () => {
    await mount({ type: "bw_listen_all", cards: [VODA] });
    const [sl, ru, pair] = container.querySelectorAll(".bw-play");
    await tap(sl);
    await wait(700);
    await tap(ru);
    await wait(700);
    await tap(pair);
    await wait(2500);
    expect(played).toEqual(["audio/sl/voda.mp3", "audio/ru/voda.mp3", "audio/ru/voda.mp3", "audio/sl/voda.mp3"]);
    await tap(container.querySelector(".bw-done"));
    expect(props.onAdvance).toHaveBeenCalledTimes(1);
  });
});
