import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import { useSessionEngine } from "./useSessionEngine";
import SessionExitPrompt from "./SessionExitPrompt";

vi.mock("@/core/syncApi", () => ({ pushOp: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/topics/renderers/engineRegistry", () => ({
  ENGINE_REGISTRY: { flashcards: () => [
    { type: "choose", conceptId: "one", cardId: "card-one" },
    { type: "choose", conceptId: "two", cardId: "card-two" },
  ] },
}));

let host, root, engine;
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  const db = await getDb();
  await kv.set(db, "sessions", []);
  useAppStore.setState({
    account: null, activeStudentId: "child", activeTopicId: "test-topic", activeModeId: "test-mode",
    activeSessionSnapshot: null, sessions: [], studentTopicLinks: {}, students: [{ id: "child" }],
    settings: { adultConfirmAdvance: true, tapToAdvance: true },
    topicRecords: [{
      meta: { id: "test-topic", renderer: "flashcards", version: "1" },
      modes: [{ id: "test-mode", type: "choose", evaluation: "auto" }],
      cards: [{ id: "card-one", conceptId: "one" }, { id: "card-two", conceptId: "two" }],
    }],
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

function EngineHost() {
  const currentEngine = useSessionEngine();
  useEffect(() => { engine = currentEngine; });
  return null;
}

it("saves a partial session, including unfinished taps, before clearing its snapshot", async () => {
  await act(async () => root.render(<EngineHost />));
  await act(async () => engine.onCorrect("one", "card-one"));
  await act(async () => engine.onAdvance());
  await act(async () => {
    engine.onCardShown("card-two", "two");
    engine.onTap("wrong-option", false);
    engine.onMistake("two", "card-two");
  });
  await act(async () => Promise.all([engine.finishCurrentSession(), engine.finishCurrentSession()]));

  const records = await kv.get(await getDb(), "sessions");
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ correctCount: 1, incorrectCount: 1, mistakes: [{ conceptId: "two", cardId: "card-two" }] });
  expect(records[0].cardEvents[0]).toMatchObject({ completed: false, taps: [{ optionId: "wrong-option", isCorrect: false }] });
  expect(pushOp).toHaveBeenCalledTimes(1);
  expect(useAppStore.getState().sessions).toHaveLength(1);
  expect(useAppStore.getState().activeSessionSnapshot).toBeNull();
  expect(await kv.get(await getDb(), "activeSession")).toBeNull();
  expect(engine.completedRecord).toBeNull();
});

it("keeps results and the active snapshot available when saving fails, then permits retry", async () => {
  await act(async () => root.render(<EngineHost />));
  await act(async () => engine.onCorrect("one", "card-one"));
  vi.spyOn(kv, "set").mockRejectedValueOnce(new Error("storage failed"));
  await act(async () => {
    await expect(engine.finishCurrentSession()).rejects.toThrow("storage failed");
  });
  expect(useAppStore.getState().activeSessionSnapshot).not.toBeNull();
  await act(async () => engine.finishCurrentSession());
  expect((await kv.get(await getDb(), "sessions"))[0].correctCount).toBe(1);
});

it("saves a completed round before starting another deck", async () => {
  await act(async () => root.render(<EngineHost />));
  await act(async () => engine.onCorrect("one", "card-one"));
  await act(async () => engine.handleRestartDeck());
  expect((await kv.get(await getDb(), "sessions"))[0].correctCount).toBe(1);
  await act(async () => engine.finishCurrentSession());
  expect(await kv.get(await getDb(), "sessions")).toHaveLength(2);
});

it("archives each mode when an endless lesson switches modes", async () => {
  const topic = useAppStore.getState().topicRecords[0];
  useAppStore.setState({ topicRecords: [{
    ...topic,
    meta: { ...topic.meta, loopModes: true },
    modes: [...topic.modes, { id: "second-mode", type: "choose", evaluation: "auto" }],
  }] });
  await act(async () => root.render(<EngineHost />));
  await act(async () => engine.onCorrect("one", "card-one"));
  await act(async () => engine.onAdvance());
  await act(async () => engine.onCorrect("two", "card-two"));
  await act(async () => engine.onAdvance());
  await vi.waitFor(() => expect(useAppStore.getState().activeModeId).toBe("second-mode"));
  await act(async () => engine.finishCurrentSession());
  const records = await kv.get(await getDb(), "sessions");
  expect(records).toHaveLength(2);
  expect(records[0]).toMatchObject({ modeId: "test-mode", correctCount: 2 });
  expect(records[1].modeId).toBe("second-mode");
});

it("offers a neutral confirmation and permits retry after a save error", async () => {
  const onFinish = vi.fn().mockRejectedValueOnce(new Error("storage failed")).mockResolvedValue(undefined);
  await act(async () => root.render(<SessionExitPrompt onContinue={vi.fn()} onFinish={onFinish} />));
  expect(host.textContent).toContain("Вы уверены, что хотите завершить занятие?");
  expect(host.textContent).not.toContain("не будет сохранён");
  await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Завершить").click());
  expect(host.querySelector('[role="alert"]').textContent).toContain("Не удалось сохранить результаты");
  await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Завершить").click());
  expect(onFinish).toHaveBeenCalledTimes(2);
});
