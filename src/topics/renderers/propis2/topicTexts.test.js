import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// The texts the adult reads behind the «i» (topic), «?» (mode) and the parameter «i» buttons (tools/propis2/topic.json). The parameter
// «i» expects {text, tip}: a plain string there opens an EMPTY window (that was the case for the dictation's level and count).
const topic = JSON.parse(readFileSync("tools/propis2/topic.json", "utf-8"));
const ru = (v) => (typeof v === "string" ? v : v?.ru);

describe("«Прописи 2»: topic, mode and parameter texts", () => {
  it("the topic has a description, goals, a final goal and steps", () => {
    const a = topic.meta.about;
    expect(a.description.length).toBeGreaterThan(80);
    expect(a.goals.length).toBeGreaterThanOrEqual(3);
    expect(a.finalGoal.length).toBeGreaterThan(40);
    expect(a.flow.length).toBeGreaterThanOrEqual(3);
  });

  it("every mode explains itself: summary, description, settings, goal, tips", () => {
    for (const mode of topic.modes) {
      const m = mode.methodology;
      expect(m, mode.id).toBeTruthy();
      for (const key of ["summary", "text", "goal"]) expect(String(m[key] ?? "").length, `${mode.id}.${key}`).toBeGreaterThan(30);
      expect(m.settings.length, `${mode.id}.settings`).toBeGreaterThan(0);
      expect(m.tips.length, `${mode.id}.tips`).toBeGreaterThan(0);
    }
  });

  it("every parameter «i» carries text and a tip (never a bare string)", () => {
    for (const mode of topic.modes) {
      for (const [key, def] of Object.entries(mode.params ?? {})) {
        if (def.type === "concept_selector") continue;
        const info = def.info?.ru;
        expect(info && typeof info === "object", `${mode.id}.${key}.info`).toBe(true);
        expect(String(info.text ?? "").length, `${mode.id}.${key}.text`).toBeGreaterThan(30);
        expect(String(info.tip ?? "").length, `${mode.id}.${key}.tip`).toBeGreaterThan(10);
      }
    }
  });

  it("no word about things this topic does not have", () => {
    const all = JSON.stringify([topic.meta.about, topic.modes.map((m) => [m.methodology, m.params])]);
    expect(all).not.toMatch(/Переписываем текст|рабочих листов/);
    expect(ru(topic.modes[0].ui.title)).toBe("Конструктор тетрадей");
  });
});
