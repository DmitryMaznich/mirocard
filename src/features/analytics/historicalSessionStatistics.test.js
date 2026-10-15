import { describe, expect, it } from "vitest";
import { recoverHistoricalSession, mergeSessionHistory } from "../../../shared/historical-session-statistics.mjs";
import { aggregateStatistics } from "../../../shared/session-statistics.mjs";

const event = (results, conceptId = "cat", extra = {}) => ({ cardId: conceptId, conceptId, attemptCount: results.length, taps: results.map((isCorrect, ms) => ({ isCorrect, ms, optionId: "option" })), ...extra });
const session = (extra = {}) => ({ id: "old", studentId: "kid", topicId: "animals", topicVersion: "1", modeId: "find_n", startedAt: "2026-10-01T10:00:00Z", completedAt: "2026-10-01T10:01:00Z", correctCount: 2, incorrectCount: 1, cardEvents: [event([false, true]), event([true], "dog")], ...extra });

describe("historical evidence recovery", () => {
  it("recovers only reconciled first responses and preserves the source", () => {
    const original = session();
    const snapshot = structuredClone(original);
    const recovered = recoverHistoricalSession(original);
    expect(recovered.statistics).toMatchObject({ schemaVersion: "legacy-1", firstTotal: 2, firstCorrect: 1, corrected: 1, conditions: null, concepts: { cat: { total: 1, correct: 0 }, dog: { total: 1, correct: 1 } }, recovery: { responses: "reconciled_taps" } });
    expect(original).toEqual(snapshot);
    expect(recoverHistoricalSession(recovered)).toBe(recovered);
  });
  it("includes unfinished wrong responses but not untouched pending cards", () => {
    const recovered = recoverHistoricalSession(session({ correctCount: 1, incorrectCount: 2, cardEvents: [event([true]), event([false, false], "dog", { completed: false }), event([], "bird", { completed: false })] }));
    expect(recovered.statistics).toMatchObject({ firstTotal: 2, firstCorrect: 1, corrected: 0 });
  });
  it("does not reconstruct first answers when retry remounts lost taps", () => {
    const original = session({ cardEvents: [event([true]), event([true], "dog")] });
    expect(recoverHistoricalSession(original).statistics).toBeUndefined();
  });
  it.each([
    { modeId: "assemble_text" },
    { cardEvents: [event([true], "cat", { attemptCount: 9 })] },
    { correctCount: 1, incorrectCount: 1, cardEvents: [event([true, false])] },
    { correctCount: 0, incorrectCount: 1, cardEvents: [event([false])] },
    { correctCount: 1, incorrectCount: 0, cardEvents: [event([true], "cat", { completed: false })] },
    { cardEvents: "invalid" },
  ])("rejects unsupported or inconsistent evidence: %j", extra => {
    expect(recoverHistoricalSession(session(extra)).statistics).toBeUndefined();
  });
  it("uses only saved params, without filling defaults or guessing absent conditions", () => {
    const recovered = recoverHistoricalSession(session({ paramsSnapshot: { optionCount: 2 }, cardEvents: [] }));
    expect(recovered.statistics.conditions).toEqual({ params: { optionCount: 2 }, historical: true, knownSettingsOnly: true });
    expect(recovered.statistics.firstTotal).toBeUndefined();
    expect(recoverHistoricalSession(session({ paramsSnapshot: {}, cardEvents: [] })).statistics).toBeUndefined();
  });
  it("recovers adult assessments without double-counting mirrored quality events", () => {
    const recovered = recoverHistoricalSession(session({ modeId: "question_answer", assessments: [{ quality: "prompted", count: 2 }, { quality: "independent" }], cardEvents: [{ quality: "prompted" }, { quality: "independent" }] }));
    expect(recovered.statistics.quality).toEqual({ prompted: 2, independent: 1 });
    expect(recovered.statistics.firstTotal).toBeUndefined();
    expect(recoverHistoricalSession(session({ modeId: "question_answer", cardEvents: [{ quality: "after_model" }] })).statistics.quality).toEqual({ after_model: 1 });
  });
  it("never changes newly measured statistics", () => {
    const current = session({ statistics: { schemaVersion: 1, firstTotal: 9, firstCorrect: 8 } });
    expect(recoverHistoricalSession(current)).toBe(current);
  });
  it("separates reconstructed evidence from native measurements and reports coverage", () => {
    const old = session({ paramsSnapshot: { optionCount: 2 } });
    const current = session({ id: "new", statistics: { schemaVersion: 1, firstTotal: 1, firstCorrect: 1, conditions: { params: { optionCount: 2 } } } });
    const report = aggregateStatistics([old, current], { studentId: "kid" });
    expect(report.groups).toHaveLength(2);
    expect(report.totals).toMatchObject({ sessions: 2, recoveredSessions: 1, recoveredResponseSessions: 1, savedSettingsSessions: 1, firstCorrect: 2, firstTotal: 3 });
  });
});

describe("preserving historical device evidence", () => {
  it("keeps a richer local snapshot when a server record and the recent-200 cache are incomplete", () => {
    const local = session({ paramsSnapshot: { optionCount: 2 } });
    const remote = session({ cardEvents: [], paramsSnapshot: null });
    const merged = mergeSessionHistory([local, session({ id: "outside-server-page" })], [remote]);
    expect(merged).toHaveLength(2);
    expect(merged[0].statistics).toMatchObject({ firstTotal: 2, conditions: { params: { optionCount: 2 } } });
    expect(merged[0].cardEvents).toEqual(local.cardEvents);
    expect(mergeSessionHistory(merged, [remote])).toEqual(merged);
  });
  it("enriches server-recovered responses with locally saved settings", () => {
    const remote = recoverHistoricalSession(session());
    const local = session({ cardEvents: [], paramsSnapshot: { optionCount: 4 } });
    const [merged] = mergeSessionHistory([local], [remote]);
    expect(merged.statistics).toMatchObject({ firstTotal: 2, conditions: { params: { optionCount: 4 } }, recovery: { savedParams: true } });
  });
  it("does not merge evidence across conflicting identities or replace native counters", () => {
    const local = session({ paramsSnapshot: { optionCount: 2 } });
    const conflict = session({ studentId: "other", cardEvents: [] });
    expect(mergeSessionHistory([local], [conflict])[0].statistics).toBeUndefined();
    const current = session({ statistics: { schemaVersion: 1, firstTotal: 8, firstCorrect: 7 } });
    expect(mergeSessionHistory([local], [current])[0].statistics).toEqual(current.statistics);
  });
  it("does not transfer first-response scores when device and server action totals disagree", () => {
    const local = session({ paramsSnapshot: { optionCount: 2 } });
    const remote = session({ cardEvents: [], correctCount: 9, incorrectCount: 7 });
    const [merged] = mergeSessionHistory([local], [remote]);
    expect(merged.statistics.firstTotal).toBeUndefined();
    expect(merged.statistics.recovery.responses).toBeNull();
    expect(merged.statistics.conditions.params).toEqual({ optionCount: 2 });
    expect(merged.correctCount).toBe(9);
  });
});
