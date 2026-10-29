import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import DictationScreen from "./DictationScreen.jsx";

// The schedule «Слушай → Пиши» follows the voice: «Слушай» while a clip sounds, «Пиши» in the pause after it; a text shows its sentence.
class FakeAudio {
  static all = [];
  constructor(url) { this.url = url; this.l = {}; FakeAudio.all.push(this); }
  addEventListener(e, f) { this.l[e] = f; }
  play() { return Promise.resolve(); }
  pause() {}
  end() { this.l.ended?.(); }
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
beforeEach(() => { vi.useFakeTimers(); FakeAudio.all = []; vi.stubGlobal("Audio", FakeAudio); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const on = () => host.querySelector(".p2d-step.is-on")?.textContent;

describe("propis2 dictation screen", () => {
  it("lights «Слушай» while the clip sounds, «Пиши» after it; «Дальше» waits for the end", () => {
    const task = { type: "dictation", level: "words", items: [{ key: "w1", display: "дом" }, { key: "w2", display: "кот" }], repeatLimit: 2 };
    act(() => root.render(<DictationScreen task={task} onClose={() => {}} />));
    expect(on()).toBe("Слушай");
    expect(host.querySelector(".p2d-next").disabled).toBe(true);
    act(() => FakeAudio.all[0].end());
    act(() => vi.runAllTimers());
    expect(on()).toBe("Пиши");
    expect(host.querySelector(".p2d-next").disabled).toBe(false);
    expect(host.querySelectorAll(".p2d-listen.is-left")).toHaveLength(2);
    act(() => host.querySelector(".p2d-next").click());
    expect(on()).toBe("Слушай");
    expect(host.querySelectorAll(".p2d-cell.is-done")).toHaveLength(1);
    expect(host.querySelector(".p2d-next").textContent).toBe("Готово");
  });

  it("a text: «Пиши» in the pause between sentences, the sentence marker moves on", () => {
    const sentences = [0, 1, 2].map((i) => ({ key: `s${i}`, display: "x" }));
    const task = { type: "dictation", level: "texts", items: [{ key: "t", display: "x", sentences }], repeatLimit: null };
    act(() => root.render(<DictationScreen task={task} onClose={() => {}} />));
    expect(host.querySelectorAll(".p2d-sentence")).toHaveLength(3);
    act(() => FakeAudio.all[0].end());
    expect(on()).toBe("Пиши");
    expect(host.querySelector(".p2d-next").disabled).toBe(true); // the text is not over
    act(() => vi.advanceTimersByTime(2500));
    expect(on()).toBe("Слушай");
    expect([...host.querySelectorAll(".p2d-sentence")].map((s) => s.className)).toEqual(["p2d-sentence is-done", "p2d-sentence is-now", "p2d-sentence"]);
  });
});
