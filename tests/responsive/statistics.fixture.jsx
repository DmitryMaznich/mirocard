import React from "react";
import { createRoot } from "react-dom/client";
import { useAppStore } from "../../src/core/store";
import StatisticsScreen from "../../src/features/analytics/StatisticsScreen";
import "../../src/styles.css";

const sessions = Array.from({ length: 12 }, (_, index) => ({
  id: `sample-${index}`, studentId: "sample-student", topicId: "emotions", modeId: "find_n", topicVersion: "1",
  completedAt: new Date(Date.now() - (12 - index) * 86400000).toISOString(), activeDurationMs: 180000,
  completionReason: index % 3 ? "manual" : "series_completed",
  statistics: { schemaVersion: 1, firstTotal: 10, firstCorrect: 5 + index % 5, corrected: 2, assisted: 0,
    conditions: { params: { optionCount: index < 6 ? 2 : 4, distractorLevel: "hard" }, optionCounts: [index < 6 ? 2 : 4], conceptIds: ["fear", "surprise"] },
    concepts: { fear: { total: 5, correct: 3 }, surprise: { total: 5, correct: 4 } },
  },
}));
sessions[0].recordState = "checkpoint";
sessions[0].completionReason = "checkpoint";
sessions[0].statistics.source = "active_snapshot";
sessions.push({ id: "legacy", studentId: "sample-student", topicId: "emotions", modeId: "find_n", topicVersion: "1", completedAt: new Date().toISOString(), correctCount: 8, incorrectCount: 2 });
sessions.push({ id: "recovered", studentId: "sample-student", topicId: "emotions", modeId: "find_n", topicVersion: "1", completedAt: new Date().toISOString(), correctCount: 2, incorrectCount: 1,
  paramsSnapshot: { optionCount: 2, distractorLevel: "hard" },
  cardEvents: [{ conceptId: "fear", attemptCount: 2, taps: [{ isCorrect: false }, { isCorrect: true }] }, { conceptId: "surprise", attemptCount: 1, taps: [{ isCorrect: true }] }],
});
useAppStore.setState({ token: null, account: null, activeStudentId: "sample-student", students: [{ id: "sample-student", name: "Маша" }, { id: "empty", name: "Петя" }], sessions,
  topicRecords: [{ meta: { id: "emotions", title: { ru: "Эмоции и чувства" } }, modes: [{ id: "find_n", ui: { title: "Найди картинку" }, params: { distractorLevel: { label: { ru: "Похожесть вариантов" } } } }], cards: [{ conceptId: "fear", label: "Страх" }, { conceptId: "surprise", label: "Удивление" }] }],
});
createRoot(document.getElementById("root")).render(<StatisticsScreen onClose={() => {}} />);
