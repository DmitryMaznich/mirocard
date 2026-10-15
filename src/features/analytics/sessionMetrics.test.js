import { describe, expect, it } from "vitest";
import { createSessionState, handleAnswer, handleAdvance, handleInstantCorrect, handleInstantIncorrect, handleInPlaceIncorrect, handleQualityAnswer, computeSessionRecord } from "../session/sessionEngine";
import { captureConditions, recordResponse } from "./sessionMetrics";
import { aggregateStatistics } from "../../../shared/session-statistics.mjs";

const mode = { id: "find_n", type: "find_n", evaluation: "auto" };
const tasks = [{ type: "find_n", targetConceptId: "cat", options: [1, 2] }, { type: "find_n", targetConceptId: "dog", options: [1, 2] }];
const makeState = (override = {}) => createSessionState(tasks, { ...mode, ...override }, "kid", "animals", "1", ["cat", "dog"]);

describe("compact first-response metrics", () => {
  it("counts a mistaken task once, retains correction separately and resets for the next task", () => {
    let state = handleAnswer(makeState(), false);
    state = handleInPlaceIncorrect(state);
    state = handleAnswer(state, true);
    state = handleAnswer(state, true); // duplicate callback on a finished task
    state = handleAdvance(state);
    state = handleAnswer(state, true);
    expect(state.statistics).toMatchObject({ firstTotal: 2, firstCorrect: 1, corrected: 1, concepts: { cat: { total: 1, correct: 0 }, dog: { total: 1, correct: 1 } } });
  });
  it("includes an unfinished wrong response and omits live task state from the saved summary", () => {
    const state = handleAnswer(makeState(), false);
    const record = computeSessionRecord(state, "kid", "animals", "1");
    expect(record.statistics).toMatchObject({ firstTotal: 1, firstCorrect: 0 });
    expect(record.statistics.current).toBeUndefined();
    expect(record.completionReason).toBe("manual");
  });
  it("collapses repeated errors and adult assessments instead of saving an outcome log", () => {
    const state = makeState();
    state.mistakes = [{ conceptId: "cat", cardId: "c1" }, { conceptId: "cat", cardId: "c1" }];
    state.assessments = [{ quality: "prompted", conceptId: "cat", cardId: "c1", taskIndex: 0 }, { quality: "prompted", conceptId: "cat", cardId: "c1", taskIndex: 1 }];
    const record = computeSessionRecord(state, "kid", "animals", "1");
    expect(record.mistakes).toEqual([{ conceptId: "cat", cardId: "c1", count: 2 }]);
    expect(record.assessments).toEqual([{ quality: "prompted", conceptId: "cat", cardId: "c1", count: 2 }]);
  });
  it("counts repeated visits in an instant loop as separate responses", () => {
    let state = makeState({ evaluation: "instant" });
    state = handleInstantIncorrect(state);
    state = handleInstantCorrect(state);
    state = handleInstantCorrect(state);
    expect(state.statistics).toMatchObject({ firstTotal: 3, firstCorrect: 2, advancedTasks: 3 });
  });
  it("does not infer first-response accuracy from multi-step scoring or practice without evaluation", () => {
    const multi = { ...makeState(), tasks: [{ type: "assemble_text" }] };
    expect(handleAnswer(multi, true, null, null, { scoreCount: 4 }).statistics.firstTotal).toBe(0);
    expect(handleAnswer(makeState({ evaluation: "none" }), true).statistics.firstTotal).toBe(0);
  });
  it("records explicit assistance separately and preserves adult quality categories", () => {
    const assisted = recordResponse(makeState(), "assisted");
    expect(assisted.statistics).toMatchObject({ firstTotal: 1, firstCorrect: 0, assisted: 1 });
    const quality = handleQualityAnswer(makeState(), "after_model", "cat", "cat");
    expect(quality.statistics).toMatchObject({ firstTotal: 0, quality: { after_model: 1 } });
  });
  it("captures defaults, actual option counts and forced transfer conditions", () => {
    const topic = { meta: { renderer: "word_formation" } };
    const conditions = captureConditions(topic, { params: { showImage: { default: true } } }, { materialSet: "transfer" }, tasks, ["dog", "cat"], null);
    expect(conditions).toMatchObject({ params: { showImage: false, activityStage: "check" }, optionCounts: [2], conceptIds: ["cat", "dog"] });
  });
});

const sample = (id, firstCorrect, firstTotal, extra = {}) => ({ id, studentId: "kid", topicId: "animals", modeId: "find_n", topicVersion: "1", completedAt: "2026-10-15T10:00:00Z", statistics: { schemaVersion: 1, firstCorrect, firstTotal, conditions: { params: { optionCount: 2 } } }, ...extra });

describe("comparable statistics", () => {
  it("counts practice days in the viewer's time zone", () => {
    const records = [sample("a", 1, 1, { completedAt: "2026-10-14T22:30:00Z" }), sample("b", 1, 1, { completedAt: "2026-10-15T10:00:00Z" })];
    expect(aggregateStatistics(records, { studentId: "kid", timeZone: "Europe/Ljubljana" }).activeDays).toBe(1);
    expect(aggregateStatistics(records, { studentId: "kid", timeZone: "UTC" }).activeDays).toBe(2);
  });
  it("uses response counts rather than averaging session percentages and deduplicates ids", () => {
    const a = sample("a", 1, 1), b = sample("b", 0, 9);
    const report = aggregateStatistics([a, b, a], { studentId: "kid" });
    expect(report.totals).toMatchObject({ sessions: 2, firstCorrect: 1, firstTotal: 10 });
  });
  it("separates changed conditions, topic versions and missing historical conditions", () => {
    const report = aggregateStatistics([sample("a", 1, 1), sample("b", 1, 1, { statistics: { schemaVersion: 1, conditions: { params: { optionCount: 4 } } } }), sample("c", 1, 1, { topicVersion: "2" }), sample("old", 0, 0, { statistics: null })], { studentId: "kid" });
    expect(report.groups).toHaveLength(4);
    expect(report.groups.find(group => !group.conditions).totals.firstTotal).toBe(0);
  });
  it("ignores decorative reward settings and object property order", () => {
    const a = sample("a", 1, 1), b = sample("b", 1, 1, { statistics: { schemaVersion: 1, conditions: { params: { strictStars: false, optionCount: 2 } } } });
    expect(aggregateStatistics([a, b], { studentId: "kid" }).groups).toHaveLength(1);
  });
  it("scopes student, topic and half-open time range and excludes invalid dates", () => {
    const records = [sample("a", 1, 1), sample("other", 1, 1, { studentId: "other" }), sample("topic", 1, 1, { topicId: "other" }), sample("invalid", 1, 1, { completedAt: "invalid" })];
    const filters = { studentId: "kid", topicId: "animals", since: "2026-10-15T00:00:00Z", until: "2026-10-16T00:00:00Z" };
    expect(aggregateStatistics(records, filters).totals.sessions).toBe(1);
    expect(aggregateStatistics(records, { ...filters, until: "2026-10-15T10:00:00Z" }).totals.sessions).toBe(0);
  });
});
