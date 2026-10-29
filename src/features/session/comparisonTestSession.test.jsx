import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { useSessionEngine } from "./useSessionEngine";
import ComparisonRenderer from "@/topics/renderers/comparison/index";

vi.mock("@/core/syncApi", () => ({ flushQueue: vi.fn().mockResolvedValue(undefined), pushOp: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/topics/renderers/engineRegistry", async () => {
  const { generateTasks } = await import("@/topics/renderers/comparison/engine");
  return { ENGINE_REGISTRY: { comparison: generateTasks } };
});
globalThis.ResizeObserver ??= class { observe() {} disconnect() {} };

const MODE = { id: "compare_test", type: "compare_evaluate", evaluation: "auto", finite: true, defaultCardId: "compare_hard", ui: { title: "7", instruction: "Реши" } };

let root, host, engine;
function Exercise() {
  const current = useSessionEngine();
  useEffect(() => { engine = current; });
  const s = current.sessionState;
  if (!current.currentTask) return null;
  return <ComparisonRenderer key={s.taskIndex} task={current.currentTask} mode={MODE} sessionStatus={s.status} taskRetry={s.taskRetry ?? 0}
    onCorrect={current.onCorrect} onIncorrect={current.onIncorrect} onMistake={current.onMistake} onAdvance={current.onAdvance} />;
}
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await kv.set(await getDb(), "sessions", []);
  useAppStore.setState({ account: null, students: [{ id: "kid" }], activeStudentId: "kid", activeTopicId: "comparison", activeModeId: MODE.id, sessions: [], activeSessionSnapshot: null,
    settings: { adultConfirmAdvance: false, tapToAdvance: false, autoAdvanceDelay: 0.1 }, studentTopicLinks: { kid_comparison: { params: { level: 5, testRange: 20, examplesCount: 4 } } },
    topicRecords: [{ meta: { id: "comparison", renderer: "comparison", version: "1" }, modes: [MODE],
      cards: [{ id: "compare_hard", conceptId: "compare_hard", primary: true, renderer: "comparison" }] }],
  });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); host.remove(); });

const SIGN = { less: "<", equal: "=", more: ">" };

it("«Контрольная работа» is one sheet: its result stays until a tap, then the lesson ends", async () => {
  await act(async () => root.render(<Exercise />));
  expect(engine.sessionState.tasks).toHaveLength(1);
  for (const item of engine.currentTask.items) {
    await act(async () => [...host.querySelectorAll(".croc-put-sign-btn")].find((b) => b.textContent === SIGN[item.question]).click());
  }
  await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));
  expect(engine.sessionState.status).toBe("answer_correct");
  expect(host.textContent).toContain("С первого раза");
  await act(async () => engine.onAdvance());
  expect(engine.sessionState.status).toBe("completed");
});
