import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { RENDERER_REGISTRY } from "@/topics/registry";
import { useSessionEngine } from "./useSessionEngine";
import { useAudio } from "@/shared/hooks/useAudio";
import ProgressBar from "@/shared/components/ProgressBar";

export default function SessionScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const {
    sessionState, currentTask, mode, topicRecord, sessionParams,
    completedRecord, onCorrect, onIncorrect, onMistake, onAdvance, onQualityAnswer,
  } = useSessionEngine();

  const { soundEnabled, toggleSound, playFeedback, playTopicFile } = useAudio();

  useEffect(() => {
    if (!completedRecord) return;
    const skipSummary = topicRecord?.meta.renderer === "reading" && mode?.type === "read_text";
    setScreen(skipSummary ? "modes" : "summary");
  }, [completedRecord, mode?.type, setScreen, topicRecord?.meta.renderer]);

  function handleCorrect(conceptId, cardId) {
    playFeedback("correct");
    onCorrect(conceptId, cardId);
  }

  function handleIncorrect(conceptId, cardId) {
    playFeedback("incorrect");
    onIncorrect(conceptId, cardId);
  }

  function handleMistake(conceptId, cardId) {
    playFeedback("incorrect");
    onMistake(conceptId, cardId);
  }

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
        <button
          className={`session-audio-icon-button${soundEnabled ? " session-audio-icon-button--active" : ""}`}
          onClick={toggleSound}
          aria-label={soundEnabled ? "Выключить звук" : "Включить звук"}
        >
          <span className="session-audio-speaker-icon">
            {soundEnabled ? "🔊" : "🔇"}
          </span>
        </button>
        <button className="session-finish-btn" onClick={() => setScreen("home")}>✕</button>
      </div>

      {feedbackClass && (
        <div className={feedbackClass}>
          {status === "answer_correct" ? "Правильно!" : "Попробуем ещё раз…"}
        </div>
      )}

      {Renderer && currentTask ? (
        <Renderer
          key={`${taskIndex}_${sessionState.taskRetry ?? 0}`}
          task={currentTask}
          mode={mode}
          sessionStatus={status}
          topicId={topicRecord.meta.id}
          sessionParams={sessionParams}
          soundEnabled={soundEnabled}
          playTopicFile={playTopicFile}
          onCorrect={handleCorrect}
          onIncorrect={handleIncorrect}
          onMistake={handleMistake}
          onAdvance={onAdvance}
          onQualityAnswer={onQualityAnswer}
        />
      ) : (
        <div className="screen-center">Неизвестный рендерер: {topicRecord.meta.renderer}</div>
      )}
    </div>
  );
}
