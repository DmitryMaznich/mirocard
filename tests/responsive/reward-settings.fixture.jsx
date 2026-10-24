import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useAppStore } from "../../src/core/store.js";
import StudentEditScreen from "../../src/features/students/StudentEditScreen.jsx";
import ParamsScreen from "../../src/features/session/ParamsScreen.jsx";
import { TimerProvider } from "../../src/features/timer/TimerContext.jsx";
import SessionHeader from "../../src/features/session/SessionHeader.jsx";
import StreakTracker from "../../src/topics/renderers/streak_tracker/index.jsx";
import { createSessionState, handleInstantCorrect, handleInstantIncorrect, handleStreakReset } from "../../src/features/session/sessionEngine.js";
import { BUILTIN_TOPICS } from "../../src/topics/builtinTopics.js";
import "../../src/styles.css";

const query = new URLSearchParams(location.search);
const settings = { algorithm: "flexible", duration: "60", animation: "normal", sound: false };
const topic = BUILTIN_TOPICS.find(item => item.meta.id === "streak_tracker");
useAppStore.setState({ students: [{ id: "kid", name: "Миша", rewardVideos: ["https://youtu.be/aaaaaaaaaaa"], rewardSettings: settings }], activeStudentId: "kid", editingStudentId: "kid", activeTopicId: topic.meta.id, activeModeId: "streak", topicRecords: [topic], studentTopicLinks: {}, account: null });
document.documentElement.classList.add("app-ios-standalone");
document.documentElement.style.setProperty("--app-safe-top", "47px");
document.documentElement.style.setProperty("--app-safe-bottom", "34px");

function Tracker() {
  const perStar = Number(query.get("perStar") || 1);
  const [state, setState] = useState(() => ({ ...createSessionState(Array.from({ length: 20 }, () => ({ type: "streak", conceptId: "c", cardId: "c" })), topic.modes[0], "kid", topic.meta.id, "1", ["c"], null, false, perStar, true, { version: 2, lossMode: "one" }), streakCount: 3 * perStar }));
  useEffect(() => { window.__rewardTest = { mistake: () => setState(s => handleStreakReset(s)), getState: () => state }; }, [state]);
  return <div className="session-screen"><div className="session-header-wrap"><SessionHeader topicTitle="5 из 5" modeTitle="5 из 5" showProgress showStreak rewardAvailable streakCount={state.streakCount} answersPerStar={perStar} rewardSettings={settings} rewardChangeReason={state.rewardChangeReason} taskIndex={state.taskIndex} total={20} evaluation="instant" onClose={() => {}} /></div>
    <div className="session-renderer-wrap"><StreakTracker task={state.tasks[state.taskIndex]} streakCount={state.streakCount} answersPerStar={perStar} rewardSettings={settings} rewardChangeReason={state.rewardChangeReason} onCorrect={() => setState(handleInstantCorrect)} onIncorrect={() => setState(handleInstantIncorrect)} /></div></div>;
}
const view = query.get("view");
createRoot(document.getElementById("root")).render(view === "tracker" ? <Tracker /> : view === "lesson" ? <TimerProvider><ParamsScreen /></TimerProvider> : <StudentEditScreen />);
