// @vitest-environment jsdom
// The system Back during solving (Android: right under the keypad on some tablets) must not throw the
// child out of a half-solved sheet, and nothing written may be lost.
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
vi.mock("@/shared/components/RewardVideoModal", () => ({ default: () => null }));
import MathTestsRenderer from "./index.jsx";
import { generateTasks } from "./engine.js";
import { interceptBack } from "@/shared/navigation/backInterceptor";
import { loadDraft } from "./draft.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} disconnect() {} };

const key = (el, label) => [...el.querySelectorAll(".mt-key")].find((b) => b.textContent === label);
const button = (el, text) => [...el.querySelectorAll("button")].find((b) => b.textContent === text);

describe("math_tests: the system Back while solving", () => {
  it("asks instead of leaving, keeps the work, and the sheet goes on from where it stopped", async () => {
    window.localStorage.clear();
    const onBack = vi.fn();
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    const mount = () => act(async () => root.render(<MathTestsRenderer task={generateTasks({ type: "solve" })[0]} accountKv={null} onBack={onBack} onSessionResult={() => {}} />));
    await mount();
    await act(async () => el.querySelector('[aria-label="Решать «Разминка до 5»"]').click());
    await act(async () => key(el, "4").click());

    // Back: stays on the sheet, asks
    let handled;
    await act(async () => { handled = interceptBack(); });
    expect(handled).toBe(true);
    expect(el.querySelector('[data-testid="math-tests-solve"]')).not.toBeNull();
    expect(el.textContent).toContain("Выйти из контрольной?");
    expect(onBack).not.toHaveBeenCalled();

    // Back again = go on solving
    await act(async () => { interceptBack(); });
    expect(el.textContent).not.toContain("Выйти из контрольной?");
    expect(el.querySelector('[data-testid="math-tests-solve"]')).not.toBeNull();

    // the work is already kept
    const d = loadDraft();
    expect(d.test.title).toBe("Разминка до 5");
    expect(Object.values(d.values)).toContain("4");

    // «Выйти» → the list shows «Продолжить»; it opens the same sheet with the «4» in place
    await act(async () => { interceptBack(); });
    await act(async () => button(el, "Выйти").click());
    expect(el.querySelector('[data-testid="math-tests-solve"]')).toBeNull();
    expect(el.textContent).toContain("Не дорешано");
    await act(async () => button(el, "Продолжить").click());
    expect(el.querySelector('[data-testid="math-tests-solve"]')).not.toBeNull();
    const texts = [...el.querySelectorAll("svg text")].map((t) => t.textContent);
    expect(texts).toContain("4");

    // from the list Back leaves the topic (the app handles it)
    await act(async () => { interceptBack(); await Promise.resolve(); });
    await act(async () => button(el, "Выйти")?.click());
    let fromList;
    await act(async () => { fromList = interceptBack(); });
    expect(fromList).toBe(false);
    act(() => root.unmount());
  });
});
