import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { RENDERER_REGISTRY } from "@/topics/registry";
import { useSessionEngine } from "./useSessionEngine";
import ProgressBar from "@/shared/components/ProgressBar";

export default function SessionScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const {
    sessionState, currentTask, mode, topicRecord,
    completedRecord, onCorrect, onIncorrect, onAdvance,
  } = useSessionEngine();

  useEffect(() => {
    if (completedRecord) setScreen("summary");
  }, [completedRecord]);

  if (!sessionState || !topicRecord || !mode) {
    return (
      <div className="session-screen">
        <div className="screen-center">Нет данных для сессии</div>
      </div>
    );
  }

  const Renderer = RENDERER_REGISTRY[topicRecord.meta.renderer];
  const { status, taskIndex, tasks, correctCount, incorrectCount } = sessionState;
  const total = tasks.length;

  const feedbackClass =
    status === "answer_correct"   ? "session-feedback session-feedback--correct"
  : status === "answer_incorrect" ? "session-feedback session-feedback--incorrect"
  : "";

  return (
    <div className="session-screen">
      <div className="session-topbar">
        <ProgressBar value={taskIndex} max={total} className="session-progress" />
        <div className="session-counter">
          {taskIndex + 1} / {total}
          {mode.evaluation === "auto" && (
            <span className="session-score">  ✓{correctCount}  ✗{incorrectCount}</span>
          )}
        </div>
        <button className="session-finish-btn" onClick={() => setScreen("home")}>✕</button>
      </div>

      {feedbackClass && (
        <div className={feedbackClass}>
          {status === "answer_correct" ? "Правильно!" : "Попробуем ещё раз…"}
        </div>
      )}

      {Renderer && currentTask ? (
        <Renderer
          task={currentTask}
          mode={mode}
          topicId={topicRecord.meta.id}
          onCorrect={onCorrect}
          onIncorrect={onIncorrect}
          onAdvance={onAdvance}
        />
      ) : (
        <div className="screen-center">Неизвестный рендерер: {topicRecord.meta.renderer}</div>
      )}
    </div>
  );
}
