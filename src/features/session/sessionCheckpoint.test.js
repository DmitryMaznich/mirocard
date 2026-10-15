import { afterEach, describe, expect, it, vi } from "vitest";
import { openDb, kv } from "@/core/db";
import { persistSessionRecord } from "./sessionPersistence";
import { recoverActiveSessionResult } from "./recoverActiveSessionResult";
import { createSessionState, handleAnswer, handleAdvance, computeSessionRecord } from "./sessionEngine";
import { mergeSessionHistory } from "../../../shared/historical-session-statistics.mjs";

const task = { type: "operation_audio", conceptId: "plus", cardId: "operation_plus", result: 5 };
const mode = { id: "operation_audio", type: "operation_audio", evaluation: "auto" };
const fresh = () => createSessionState([task, task], mode, "kid", "addition_subtraction", "1", ["plus"]);
const record = (state, extra = {}) => ({ ...computeSessionRecord(state, "kid", "addition_subtraction", "1", [], { recordState: "checkpoint", completionReason: "checkpoint", completedAt: state.lastActivityAt }), ...extra });
const queue = db => new Promise(resolve => { const request = db.transaction("syncQueue").objectStore("syncQueue").getAll(); request.onsuccess = () => resolve(request.result); });
afterEach(() => vi.useRealTimers());

describe("durable cumulative checkpoints", () => {
  it("does not mark unattempted words as correct in an unfinished text", () => {
    const state = { ...fresh(), totalWords: 40, correctCount: 1, incorrectCount: 2 };
    const partial = record(state);
    expect(partial.correctCount).toBeNull();
    expect(partial.incorrectCount).toBeNull();
    expect(partial.percentCorrect).toBeNull();
  });
  it("updates one result and one queued upload; a stale checkpoint cannot overwrite newer answers or finalization", async () => {
    const db = await openDb(`checkpoints-${Math.random()}`);
    const one = handleAnswer(fresh(), true);
    const two = handleAnswer(handleAdvance(one), true);
    const snapshot = { context: { studentId: "kid" }, sessionState: two };
    const first = record(one), second = record(two);
    await persistSessionRecord(db, first);
    await persistSessionRecord(db, second, { snapshot });
    await persistSessionRecord(db, first);
    expect((await kv.get(db, "sessions"))).toHaveLength(1);
    expect((await kv.get(db, "sessions"))[0].correctCount).toBe(2);
    expect(await queue(db)).toHaveLength(1);
    expect((await queue(db))[0].data.correctCount).toBe(2);
    const final = { ...second, recordState: "final", completionReason: "manual" };
    await persistSessionRecord(db, final, { clearSnapshot: true });
    await persistSessionRecord(db, { ...second, recordRevision: 999 }, { snapshot });
    expect((await kv.get(db, "sessions"))[0]).toEqual(final);
    expect(await kv.get(db, "activeSession")).toBeNull();
    expect(await queue(db)).toHaveLength(1);
    expect((await queue(db))[0].data.recordState).toBe("final");
    db.close();
  });
  it("does not allow a late server refresh to discard an offline checkpoint", () => {
    const one = record(handleAnswer(fresh(), false));
    const two = { ...one, recordRevision: one.recordRevision + 1, correctCount: 1 };
    expect(mergeSessionHistory([two], [one])[0].correctCount).toBe(1);
    const final = { ...two, recordState: "final", completionReason: "manual" };
    expect(mergeSessionHistory([final], [two])[0].recordState).toBe("final");
    expect(mergeSessionHistory([two], [final])[0].recordState).toBe("final");
  });
  it("keeps earlier practice on its date when the same exercise resumes next day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 14, 18, 0));
    const yesterday = handleAnswer(fresh(), false);
    vi.setSystemTime(new Date(2026, 9, 15, 8, 0));
    const today = handleAnswer(yesterday, true);
    expect(today.id).not.toBe(yesterday.id);
    expect(today.statisticsDay).toBe("2026-10-15");
    expect(today.correctCount).toBe(1);
    expect(today.incorrectCount).toBe(0);
    expect(today.statistics.firstTotal).toBe(0); // correcting yesterday's first response
    expect(today.statistics.corrected).toBe(1);
    expect(yesterday.incorrectCount).toBe(1);
    expect(record(yesterday).completedAt).toBe(yesterday.lastActivityAt);
  });
  it("recovers an old unsaved snapshot once, preserves resumption, and does not infer settings or daily answers", async () => {
    const db = await openDb(`snapshot-recovery-${Math.random()}`);
    const state = fresh();
    delete state.statistics;
    state.correctCount = 4; state.incorrectCount = 1;
    const snapshot = { updatedAt: new Date().toISOString(), context: { studentId: "kid", topicId: "addition_subtraction", modeId: "operation_audio" }, sessionState: state };
    await kv.set(db, "activeSession", snapshot);
    const recovered = await recoverActiveSessionResult(db, snapshot, ["kid"]);
    expect(recovered).toMatchObject({ recordState: "checkpoint", correctCount: 4, incorrectCount: 1, statistics: { source: "active_snapshot" } });
    expect(recovered.statistics.firstTotal).toBeUndefined();
    expect(recovered.paramsSnapshot).toEqual({});
    expect(await recoverActiveSessionResult(db, snapshot, ["kid"])).toBeNull();
    expect(await kv.get(db, "activeSession")).toEqual(snapshot);
    expect(await queue(db)).toHaveLength(1);
    db.close();
  });
});
