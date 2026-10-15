import { expect, it } from "vitest";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import JSZip from "jszip";
import { BUILTIN_TOPICS } from "@/topics/builtinTopics";
import { getDefaultModeSettings, getTopicRecord } from "@/topics/topicLoader";
import { openDb, kv } from "@/core/db";
import { SINGLE_RESPONSE_TYPES, captureConditions } from "./sessionMetrics";
import { createSessionState, handleAnswer, handleAdvance, computeSessionRecord } from "@/features/session/sessionEngine";
import { persistSessionRecord } from "@/features/session/sessionPersistence";

it("inventories all shipped modes without claiming unreviewed renderer callbacks are verified", async () => {
  const records = [...BUILTIN_TOPICS];
  const unavailable = [];
  const catalog = JSON.parse(readFileSync("public/decks/catalog.json", "utf8"));
  for (const entry of catalog.decks) {
    const archive = `public/decks/${basename(entry.file ?? entry.url ?? "")}`;
    if (!existsSync(archive)) { unavailable.push(entry.id); continue; }
    const zip = await JSZip.loadAsync(readFileSync(archive));
    const file = zip.file("topic.json");
    if (!file) { unavailable.push(entry.id); continue; }
    records.push(JSON.parse(await file.async("string")));
  }
  const modes = new Map();
  const db = await openDb(`statistics-mode-audit-${Math.random()}`);
  try {
    for (const raw of records) {
      await kv.set(db, `topic:${raw.meta.id}`, { ...raw, cards: raw.cards ?? [] });
      // Use the same migration as the app: manifests can omit code-owned modes.
      const topic = await getTopicRecord(db, raw.meta.id);
      for (const declaredMode of topic.modes ?? []) {
        const evaluation = getDefaultModeSettings(topic.meta?.renderer, declaredMode.id)?.evaluation ?? declaredMode.evaluation;
        const mode = { ...declaredMode, evaluation };
        const tasks = [{ type: mode.type, conceptId: "audit" }];
        let state = createSessionState(tasks, mode, "audit-student", topic.meta.id, topic.meta.version, ["audit"]);
        state.statistics.conditions = captureConditions(topic, mode, {}, tasks, ["audit"], null);
        state = evaluation === "none" ? handleAdvance(state) : handleAnswer(state, true);
        const record = computeSessionRecord(state, "audit-student", topic.meta.id, topic.meta.version, [], { recordState: "checkpoint", completionReason: "checkpoint" });
        const saved = await persistSessionRecord(db, record);
        expect(saved.modeId).toBe(mode.id);
        expect(saved.statistics.conditions.params).toEqual(state.statistics.conditions.params);
        expect(saved.correctCount).toBe(evaluation === "none" ? null : 1);
        // Each case checks one mode's contract; queued records from other
        // cases are not part of this test (queue coalescing has its own test).
        db.transaction("syncQueue", "readwrite").objectStore("syncQueue").clear();
        modes.set(`${topic.meta.id}:${mode.id}`, {
          topicId: topic.meta.id, renderer: topic.meta.renderer, modeId: mode.id, type: mode.type, evaluation,
          storage: "shared_engine_checkpoint", sharedEngineVerification: "answer_or_advance_to_indexeddb",
          firstResponse: SINGLE_RESPONSE_TYPES.has(mode.type) ? "enabled" : "not_inferred",
          rendererVerification: topic.meta.renderer === "addition_subtraction" && mode.type === "operation_audio" ? "keypad_to_persistence_regression" : "requires_mode_review",
          scoring: evaluation === "none" ? "practice_without_accuracy" : SINGLE_RESPONSE_TYPES.has(mode.type) ? "first_response_and_action_counts" : "action_counts_or_explicit_adult_quality",
        });
      }
    }
  } finally { db.close(); }
  expect([...modes.values()].some(mode => mode.modeId === "operation_audio" && mode.rendererVerification === "keypad_to_persistence_regression")).toBe(true);
  expect(modes.size).toBeGreaterThan(50);
  mkdirSync(".cache", { recursive: true });
  writeFileSync(".cache/statistics-mode-audit.json", JSON.stringify({ modeCount: modes.size, topicCount: new Set([...modes.values()].map(mode => mode.topicId)).size, unavailableArchives: unavailable, modes: [...modes.values()] }, null, 2));
}, 20000);
