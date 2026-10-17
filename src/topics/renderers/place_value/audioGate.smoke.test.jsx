import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import PlaceValueRenderer from "./index.jsx";
import { ALL_AUDIO_URLS } from "./numberAudio.js";
import { coinHarness } from "./coinTestHelpers.jsx";

// Order matters: the clips, once loaded, stay loaded for the app session.
describe("No voiced task without the voice", () => {
  const h = coinHarness();
  const task = { type: "number_names", cardId: "n", conceptId: "n", number: 90, options: [19, 90, 900], supportMode: "learning" };
  const Renderer = (props) => <PlaceValueRenderer {...props} sessionParams={{}} />;
  const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(10); });

  it("no connection: the task doesn't start; «Повторить» loads every clip, then the task", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const c = h.mount(Renderer, task);
    expect(c.querySelector(".pv-audio-gate__title").textContent).toBe("Загружаю голос…");
    await flush();
    expect(c.querySelector(".pv-audio-gate__title").textContent).toBe("Голос не загрузился");
    expect(c.querySelector(".nn-option")).toBeNull();
    const fetch = vi.fn(() => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }));
    vi.stubGlobal("fetch", fetch);
    h.click("Повторить");
    await flush();
    expect(fetch).toHaveBeenCalledTimes(ALL_AUDIO_URLS.length);
    expect(c.querySelector(".pv-audio-gate")).toBeNull();
    expect(c.querySelectorAll(".nn-option")).toHaveLength(3);
  });

  it("once loaded, the next voiced task starts at once", () => {
    const c = h.mount(Renderer, { ...task, cardId: "m", number: 30, options: [13, 30, 300] });
    expect(c.querySelector(".pv-audio-gate")).toBeNull();
  });

  it("a task without a voice never waits", () => {
    const c = h.mount(Renderer, { type: "place_parts", cardId: "p", conceptId: "p", number: 47, direction: "split", prompt: "digits", supportMode: "learning" });
    expect(c.querySelector(".pv-audio-gate")).toBeNull();
  });
});
