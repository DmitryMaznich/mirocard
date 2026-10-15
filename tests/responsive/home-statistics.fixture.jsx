import React from "react";
import { createRoot } from "react-dom/client";
import { useAppStore } from "../../src/core/store";
import HomeScreen from "../../src/features/home/HomeScreen";
import "../../src/styles.css";

const state = new URLSearchParams(location.search).get("state") ?? "ready";
const topic = { meta: { id: "addition_subtraction", renderer: "addition_subtraction", title: { ru: "Плюсы-минусы" }, version: "1" }, modes: [{ id: "operation_audio", type: "operation_audio", ui: { title: "Слушай и посчитай" }, params: { maxNumber: { label: { ru: "Числа до" }, default: 20 } } }], cards: [{ id: "plus", conceptId: "plus", primary: true, label: "Плюс" }] };
const sample = { id: "sample", studentId: "kid", topicId: topic.meta.id, topicVersion: "1", modeId: "operation_audio", completedAt: new Date().toISOString(), correctCount: 8, incorrectCount: 2, activeDurationMs: 180000, recordState: "checkpoint", completionReason: "checkpoint", statistics: { schemaVersion: 1, firstCorrect: 8, firstTotal: 10, corrected: 2, conditions: { params: { maxNumber: 20 }, conceptIds: ["plus"], taskTypes: ["operation_audio"] } } };
if (state !== "first-entry") localStorage.setItem("mirocard_home_picker_confirmed_kid", JSON.stringify({ topic: true, mode: true }));
useAppStore.setState({ token: null, account: state === "all-tools" ? { id: "fixture", featureFlags: ["planner", "lesson_plan", "instructions"] } : null, homeActiveTab: "session", screen: "home", activeStudentId: "kid", students: [{ id: "kid", name: "Миша" }], activeTopicId: topic.meta.id, activeModeId: "operation_audio", topicRecords: [topic], sessions: ["ready", "all-tools"].includes(state) ? [sample] : [], buildInfo: { version: "1.0.2600" }, studentTopicLinks: {} });
createRoot(document.getElementById("root")).render(<HomeScreen />);
