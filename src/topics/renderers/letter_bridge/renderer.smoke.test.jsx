import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import LetterBridgeRenderer from "./index.jsx";

const S = { id: "S", conceptId: "S", sl: "S", ru: "С", soundSl: "audio/letters/sl/S.mp3" };
const R = { id: "R", conceptId: "R", sl: "R", ru: "Р" };
const N = { id: "N", conceptId: "N", sl: "N", ru: "Н" };
const P = { id: "P", conceptId: "P", sl: "P", ru: "П", soundRu: "audio/letters/ru/P.mp3", soundSl: "audio/letters/sl/P.mp3" };
const SOK = { id: "sok", sl: "SOK", ru: "СОК", image: "data:image/webp;base64,AA==", audio: "audio/sl/sok.mp3" };
const VODA = { id: "voda", sl: "VODA", ru: "ВОДА", image: "data:image/webp;base64,AA==", audio: "audio/sl/voda.mp3" };

describe("letter_bridge renderer", () => {
  let container;
  let root;
  let props;

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    props = {
      topicId: "learn_slovene",
      student: { id: "st1" },
      mode: { twins: { P: "Р" } },
      playTopicFile: vi.fn(async () => true),
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
    await act(async () => { root.render(<LetterBridgeRenderer task={task} {...props} />); });
  }
  const wait = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  const tap = (el) => act(async () => { el.click(); });
  const option = (label) => container.querySelector(`[aria-label="${label}"]`);

  it("«Пара букв»: home letter sounds, then the school letter appears and sounds, then «Дальше»", async () => {
    await mount({ type: "lb_pair", conceptId: "P", card: P });
    const next = container.querySelector(".lb-next");
    const slCol = container.querySelectorAll(".lb-pair__col")[1];
    expect(slCol.className).toContain("lb-hidden");
    expect(next.disabled).toBe(true);
    await tap(option("P"));
    await tap(next);
    expect(props.onAdvance).not.toHaveBeenCalled();
    await wait(600);
    expect(props.playTopicFile).toHaveBeenLastCalledWith("learn_slovene", "audio/letters/ru/P.mp3");
    expect(option("П").className).toContain("lb-card--speaking");
    await wait(1500);
    expect(slCol.className).not.toContain("lb-hidden");
    await wait(600);
    expect(props.playTopicFile).toHaveBeenLastCalledWith("learn_slovene", "audio/letters/sl/P.mp3");
    expect(container.querySelector(".lb-card--trap")).not.toBeNull();
    await wait(1500);
    expect(next.disabled).toBe(false);
    await tap(option("П"));
    expect(props.playTopicFile).toHaveBeenLastCalledWith("learn_slovene", "audio/letters/ru/P.mp3");
    expect(props.onAdvance).not.toHaveBeenCalled();
    await tap(next);
    await tap(next);
    expect(props.onAdvance).toHaveBeenCalledTimes(1);
  });

  it("a right first tap counts as alone", async () => {
    await mount({ type: "lb_find", conceptId: "S", card: S, dir: "sl_ru", options: [R, S, N] });
    expect(container.querySelector(".lb-card").textContent).toBe("S");
    await tap(option("С"));
    expect(option("С").className).toContain("lb-opt--correct");
    expect(props.playTopicFile).toHaveBeenCalledWith("learn_slovene", "audio/letters/sl/S.mp3");
    await wait(1200);
    expect(props.onCorrect).toHaveBeenCalledWith("S", "S", undefined);
    expect(props.onStreakReset).not.toHaveBeenCalled();
  });

  it("a wrong tap fades it, shows the right one, and the answer then counts as help", async () => {
    await mount({ type: "lb_find", conceptId: "S", card: S, dir: "sl_ru", options: [R, S, N] });
    await tap(option("Р"));
    expect(props.onStreakReset).toHaveBeenCalledWith("S", "S");
    expect(option("Р").className).toContain("lb-opt--faded");
    expect(option("С").className).toContain("lb-opt--hint");
    await tap(option("Р"));
    expect(props.onStreakReset).toHaveBeenCalledTimes(1);
    await tap(option("С"));
    await wait(1200);
    expect(props.onCorrect).toHaveBeenCalledWith("S", "S", { assisted: true });
  });

  it("«С → S» shows the Russian letter and Slovenian options", async () => {
    await mount({ type: "lb_find", conceptId: "S", card: S, dir: "ru_sl", options: [R, S, N] });
    expect(container.querySelector(".lb-card").textContent).toBe("С");
    expect(option("S")).not.toBeNull();
  });

  it("«Слова»: the auto hint is bright at first, the recording plays after the answer", async () => {
    const task = { type: "lb_word", conceptId: "word:sok", word: SOK, translit: "СОК", hint: "auto", options: [{ word: VODA, ok: false }, { word: SOK, ok: true }] };
    await mount(task);
    expect(container.querySelector(".lb-translit").style.opacity).toBe("0.85");
    await tap(option("SOK"));
    await wait(1000);
    expect(props.playTopicFile).toHaveBeenCalledWith("learn_slovene", "audio/sl/sok.mp3");
    expect(props.onCorrect).toHaveBeenCalledWith("word:sok", "sok", undefined);
    expect(JSON.parse(window.localStorage.getItem("letter-bridge:reads:st1"))).toEqual({ sok: 1 });
  });

  it("«Слова»: after four lone reads the hint is gone", async () => {
    window.localStorage.setItem("letter-bridge:reads:st1", JSON.stringify({ sok: 4 }));
    await mount({ type: "lb_word", conceptId: "word:sok", word: SOK, translit: "СОК", hint: "auto", options: [{ word: SOK, ok: true }] });
    expect(container.querySelector(".lb-translit").style.opacity).toBe("0");
  });

  it("«Собери слово»: wrong tile shakes and costs help; the right ones fill the slots", async () => {
    await mount({ type: "lb_build", conceptId: "word:sok", word: SOK, tiles: ["K", "Z", "O", "S"] });
    await tap(option("Z"));
    expect(props.onStreakReset).toHaveBeenCalledTimes(1);
    await tap(option("S"));
    await tap(option("O"));
    await tap(option("K"));
    expect([...container.querySelectorAll(".lb-slot--filled")].map((s) => s.textContent).join("")).toBe("SOK");
    await wait(1000);
    expect(props.onCorrect).toHaveBeenCalledWith("word:sok", "sok", { assisted: true });
  });

  it("«нужно больше букв» explains and moves on", async () => {
    await mount({ type: "lb_need_more", text: "Добавьте буквы" });
    expect(container.textContent).toContain("Добавьте буквы");
    await tap(container.querySelector(".lb-next"));
    expect(props.onAdvance).toHaveBeenCalledTimes(1);
  });

  it("«Учим алфавит» check: the sound plays by itself, the child picks the Slovenian letter", async () => {
    await mount({ type: "lb_listen", conceptId: "S", card: S, runId: "r2", block: "g2", options: [R, S, N] });
    await wait(450);
    expect(props.playTopicFile).toHaveBeenCalledWith("learn_slovene", "audio/letters/sl/S.mp3");
    expect(option("С")).toBeNull();
    await tap(option("S"));
    await wait(1200);
    expect(props.onCorrect).toHaveBeenCalledWith("S", "S", undefined);
  });

  it("«Слоги»: the syllable sounds by itself, a wrong pick says it again, the answer shows KA = КА", async () => {
    await mount({ type: "lb_syll", conceptId: "K", cardId: "K", syl: "KA", sound: "audio/syllables/sl/ka.mp3", translit: "КА",
      options: [{ text: "GA", ok: false }, { text: "KA", ok: true }, { text: "KO", ok: false }] });
    await wait(450);
    expect(props.playTopicFile).toHaveBeenCalledWith("learn_slovene", "audio/syllables/sl/ka.mp3");
    expect(container.textContent).not.toMatch(/[А-Я]/);
    await tap(option("GA"));
    expect(props.playTopicFile).toHaveBeenCalledTimes(2);
    expect(props.onStreakReset).toHaveBeenCalledWith("K", "K");
    await tap(option("KA"));
    expect(container.textContent).toContain("KA = КА");
    await wait(1500);
    expect(props.onCorrect).toHaveBeenCalledWith("K", "K", { assisted: true });
  });

  it("between blocks the adult chooses: next block or finish", async () => {
    props.onClose = vi.fn();
    await mount({ type: "lb_block_end", runId: "r1", block: "g1", title: "Друзья", next: "Звук тот же" });
    expect(container.textContent).toContain("Блок «Друзья» пройден");
    await tap(container.querySelector(".lb-finish"));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onAdvance).not.toHaveBeenCalled();
  });

  it("after the last block «Закончить» ends the lesson", async () => {
    await mount({ type: "lb_block_end", runId: "r1", block: "g4", title: "Ловушки", next: null });
    expect(container.textContent).toContain("Весь алфавит пройден");
    await tap(container.querySelector(".lb-next"));
    expect(props.onAdvance).toHaveBeenCalledTimes(1);
  });
});
