// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
vi.mock("@/shared/components/RewardVideoModal", () => ({ default: () => null }));
import MathTestsRenderer from "./index.jsx";
import { generateTasks } from "./engine.js";
import { fullScreenSessionRecord } from "@/features/printLetters/fullScreenSession";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} disconnect() {} };

async function mount(task, onSessionResult) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  await act(async () => createRoot(el).render(<MathTestsRenderer task={task} accountKv={null} onBack={() => {}} onSessionResult={onSessionResult} />));
  return el;
}

describe("math_tests modes", () => {
  it("the engine opens the mode's screen", () => {
    expect(generateTasks({ type: "solve" })[0].type).toBe("math_tests_solve");
    expect(generateTasks({ type: "constructor" })[0].type).toBe("math_tests_constructor");
  });

  it("«Решить контрольную»: a ready sheet opens straight for solving, «Проверить» reports a lesson", async () => {
    window.localStorage.clear();
    const onSessionResult = vi.fn();
    const el = await mount(generateTasks({ type: "solve" })[0], onSessionResult);
    expect(el.textContent).toContain("Решить контрольную");
    expect(el.textContent).not.toContain("Новая контрольная");
    const open = el.querySelector('[aria-label="Решать «Разминка до 5»"]');
    await act(async () => open.click());
    expect(el.querySelector('[data-testid="math-tests-solve"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="math-tests-editor"]')).toBeNull();
    const five = [...el.querySelectorAll(".mt-key")].find((b) => b.textContent === "5");
    await act(async () => five.click());
    const check = [...el.querySelectorAll("button")].find((b) => b.textContent === "Проверить");
    await act(async () => check.click());
    expect(onSessionResult).toHaveBeenCalledTimes(1);
    const r = onSessionResult.mock.calls[0][0];
    expect(r.total).toBeGreaterThan(0);
    expect(r.testTitle).toBe("Разминка до 5");
    expect(r.startedAt).toBeLessThanOrEqual(r.at);
    // not copied into «Мои контрольные»
    expect(JSON.parse(window.localStorage.getItem("mirocard:math_tests:tests") ?? "[]")).toHaveLength(0);
  });

  it("the constructor still opens on «Мои контрольные» with «Новая контрольная»", async () => {
    const el = await mount(generateTasks({ type: "constructor" })[0], vi.fn());
    expect(el.textContent).toContain("Новая контрольная");
  });

  it("a check becomes a compact session record", () => {
    const rec = fullScreenSessionRecord({
      result: { right: 7, total: 10, at: Date.parse("2026-11-12T10:10:00Z"), startedAt: Date.parse("2026-11-12T10:00:00Z"), testTitle: "Т" },
      studentId: "s1",
      record: { meta: { id: "math_tests", version: "0.2.0" } },
      mode: { id: "solve" },
    });
    expect(rec).toMatchObject({ studentId: "s1", topicId: "math_tests", topicVersion: "0.2.0", modeId: "solve", correctCount: 7, incorrectCount: 3, percentCorrect: 70, recordState: "final", elapsedDurationMs: 600000 });
    expect(rec.paramsSnapshot.testTitle).toBe("Т");
  });
});
