import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { useSessionEngine } from "./useSessionEngine";
import AdditionSubtractionRenderer from "@/topics/renderers/addition_subtraction/index";

vi.mock("@/core/syncApi", () => ({ flushQueue: vi.fn().mockResolvedValue(undefined), pushOp: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/topics/renderers/addition_subtraction/useAudioSequence", () => ({ useAudioSequence: () => ({ isPlaying: false, play: () => {} }) }));
vi.mock("@/topics/renderers/engineRegistry", async () => {
  const { generateTasks } = await import("@/topics/renderers/addition_subtraction/engine");
  return { ENGINE_REGISTRY: { addition_subtraction: generateTasks } };
});

let root, host, engine;
function Exercise() {
  const current = useSessionEngine();
  useEffect(() => { engine = current; });
  return <AdditionSubtractionRenderer key={`${current.sessionState.taskIndex}:${current.sessionState.taskRetry ?? 0}`} task={current.currentTask} onCorrect={current.onCorrect} onIncorrect={current.onIncorrect} />;
}
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await kv.set(await getDb(), "sessions", []);
  useAppStore.setState({ account: null, students: [{ id: "kid" }], activeStudentId: "kid", activeTopicId: "addition_subtraction", activeModeId: "operation_audio", sessions: [], activeSessionSnapshot: null,
    settings: { adultConfirmAdvance: true, tapToAdvance: true }, studentTopicLinks: {},
    topicRecords: [{ meta: { id: "addition_subtraction", renderer: "addition_subtraction", version: "1" },
      modes: [{ id: "operation_audio", type: "operation_audio", evaluation: "auto", params: { maxNumber: { default: 20 } } }],
      cards: [{ id: "operation_plus", conceptId: "plus", primary: true, renderer: "addition_subtraction", params: { operation: "add" } }, { id: "operation_minus", conceptId: "minus", primary: true, renderer: "addition_subtraction", params: { operation: "subtract" } }],
    }],
  });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); host.remove(); });
const click = async button => act(async () => button.click());
async function answer(value) {
  for (const digit of String(value)) await click([...host.querySelectorAll(".operation-audio-keypad__grid button")].find(button => button.textContent === digit));
  await click(host.querySelector('[aria-label="Проверить"]'));
}

it("records real keypad errors and corrections before any of the 500-task series is finished, and survives leaving/reopening", async () => {
  await act(async () => root.render(<Exercise />));
  expect(engine.sessionState.tasks).toHaveLength(500);
  const result = engine.currentTask.result;
  await answer(result === 0 ? 1 : 0);
  await act(async () => new Promise(resolve => setTimeout(resolve, 1600)));
  await answer(result);
  await vi.waitFor(async () => {
    const [saved] = (await kv.get(await getDb(), "sessions")) ?? [];
    expect(saved).toMatchObject({ modeId: "operation_audio", recordState: "checkpoint", correctCount: 1, incorrectCount: 1, statistics: { firstTotal: 1, firstCorrect: 0, corrected: 1 } });
  });
  expect(engine.completedRecord).toBeNull();
  expect(engine.sessionState.status).toBe("answer_correct");
  await act(async () => root.unmount()); root = null;
  expect(await kv.get(await getDb(), "sessions")).toHaveLength(1);
  useAppStore.setState({ activeSessionSnapshot: await kv.get(await getDb(), "activeSession") });
  root = createRoot(host);
  await act(async () => root.render(<Exercise />));
  expect(engine.sessionState.correctCount).toBe(1);
  await act(async () => engine.finishCurrentSession());
  const saved = await kv.get(await getDb(), "sessions");
  expect(saved).toHaveLength(1);
  expect(saved[0].completionReason).toBe("manual");
  expect(saved[0].recordState).toBe("final");
});
