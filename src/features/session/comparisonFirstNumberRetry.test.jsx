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

const MODE = { id: "compare_first_number", type: "compare_first_number", evaluation: "auto", defaultCardId: "compare_medium", ui: { title: "5", instruction: "Сравни" } };

let root, host, engine;
function Exercise() {
  const current = useSessionEngine();
  useEffect(() => { engine = current; });
  const s = current.sessionState;
  return <ComparisonRenderer key={`${s.taskIndex}:${s.taskRetry ?? 0}`} task={current.currentTask} mode={MODE} sessionStatus={s.status} taskRetry={s.taskRetry ?? 0}
    onCorrect={current.onCorrect} onIncorrect={current.onIncorrect} onMistake={current.onMistake} onAdvance={current.onAdvance} />;
}
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await kv.set(await getDb(), "sessions", []);
  useAppStore.setState({ account: null, students: [{ id: "kid" }], activeStudentId: "kid", activeTopicId: "comparison", activeModeId: MODE.id, sessions: [], activeSessionSnapshot: null,
    settings: { adultConfirmAdvance: false, tapToAdvance: true }, studentTopicLinks: {},
    topicRecords: [{ meta: { id: "comparison", renderer: "comparison", version: "1" }, modes: [MODE],
      cards: [{ id: "compare_medium", conceptId: "compare_medium", primary: true, renderer: "comparison" }] }],
  });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); host.remove(); });

const LABEL = { less: "Меньше", equal: "Равно", more: "Больше" };
const press = async (label) => act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(label)).click());

it("«Сравни первое и второе»: after a mistake the same pair comes back to answer, not a dead end", async () => {
  await act(async () => root.render(<Exercise />));
  const first = engine.currentTask;
  const wrong = Object.keys(LABEL).find((q) => q !== first.question);
  await press(LABEL[wrong]);
  await act(async () => new Promise((resolve) => setTimeout(resolve, 1700)));
  expect(engine.sessionState.status).toBe("task_active");
  expect(engine.sessionState.taskRetry).toBe(1);
  expect(engine.currentTask).toBe(first);
  expect([...host.querySelectorAll(".cfn-btn")].every((b) => !b.disabled)).toBe(true);
  await press(LABEL[first.question]);
  expect(engine.sessionState.status).toBe("answer_correct");
  await act(async () => host.querySelector(".cfn-result-tap").click());
  expect(engine.sessionState.taskIndex).toBe(1);
});
