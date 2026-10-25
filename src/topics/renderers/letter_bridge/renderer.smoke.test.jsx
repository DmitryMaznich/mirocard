import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import LetterBridgeRenderer from "./index.jsx";

const S = { id: "S", conceptId: "S", sl: "S", ru: "С" };
const R = { id: "R", conceptId: "R", sl: "R", ru: "Р" };
const N = { id: "N", conceptId: "N", sl: "N", ru: "Н" };
const P = { id: "P", conceptId: "P", sl: "P", ru: "П" };
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

  it("«Пара букв»: home and school labels in Russian, a tap on the Slovenian letter moves on", async () => {
    await mount({ type: "lb_pair", conceptId: "P", card: P });
    const cards = [...container.querySelectorAll(".lb-card")].map((c) => c.textContent);
    expect(cards).toEqual(["П", "P"]);
    const labels = [...container.querySelectorAll(".lb-place")].map((l) => l.textContent);
    expect(labels).toEqual(["Домапо-русски", "В школепо-словенски"]);
    expect(container.querySelector(".lb-card--trap")).not.toBeNull();
    await tap(option("P"));
    await tap(option("P"));
    expect(props.onAdvance).not.toHaveBeenCalled();
    await wait(600);
    expect(props.onAdvance).toHaveBeenCalledTimes(1);
    await tap(container.querySelector(".lb-skip"));
    expect(props.onAdvance).toHaveBeenCalledTimes(2);
  });

  it("a right first tap counts as alone", async () => {
    await mount({ type: "lb_find", conceptId: "S", card: S, dir: "sl_ru", options: [R, S, N] });
    expect(container.querySelector(".lb-card").textContent).toBe("S");
    await tap(option("С"));
    expect(option("С").className).toContain("lb-opt--correct");
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
});
