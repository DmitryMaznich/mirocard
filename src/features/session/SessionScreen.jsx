import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { RENDERER_REGISTRY } from "@/topics/registry";
import { loadRenderer } from "@/topics/rendererLoader";
import { useSessionEngine } from "./useSessionEngine";
import { useAudio } from "@/shared/hooks/useAudio";
import ProgressBar from "@/shared/components/ProgressBar";

export default function SessionScreen() {
  const setScreen       = useAppStore((s) => s.setScreen);
  const students        = useAppStore((s) => s.students);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeStudent   = students.find((s) => s.id === activeStudentId) ?? null;

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

  // Dynamic renderer: prefer renderer.js from IndexedDB, fall back to registry.
  const [Renderer, setRenderer]           = useState(() =>
    topicRecord ? (RENDERER_REGISTRY[topicRecord.meta.renderer] ?? null) : null
  );
  const [rendererReady, setRendererReady] = useState(
    () => !!(topicRecord && RENDERER_REGISTRY[topicRecord.meta.renderer])
  );
  useEffect(() => {
    if (!topicRecord) return;
    loadRenderer(topicRecord.meta.id)
      .then((DynamicRenderer) => {
        setRenderer(() => DynamicRenderer ?? RENDERER_REGISTRY[topicRecord.meta.renderer] ?? null);
      })
      .catch(() => {
        setRenderer(() => RENDERER_REGISTRY[topicRecord.meta.renderer] ?? null);
      })
      .finally(() => setRendererReady(true));
  }, [topicRecord?.meta.id]);

  if (!sessionState || !topicRecord || !mode) {
    return (
      <div className="session-screen">
        <div className="screen-center">Нет данных для сессии</div>
      </div>
    );
  }

  const { status, taskIndex, tasks, correctCount, incorrectCount } = sessionState;
  const total = tasks.length;

  const isCorrectFeedback   = status === "answer_correct";
  const isIncorrectFeedback = status === "answer_incorrect";

  const feedbackClass =
    isCorrectFeedback   ? "session-feedback session-feedback--correct"
  : isIncorrectFeedback ? "session-feedback session-feedback--incorrect"
  : "";

  const topicTitle = topicRecord.meta.title ?? topicRecord.meta.id;
  const modeTitle  = mode.ui?.title ?? mode.id;

  return (
    <div className="session-screen">
      <div className="session-topbar">
        <div className="session-topbar-controls">
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
        <div className="session-subtitle">{topicTitle} · {modeTitle}</div>
      </div>

      {feedbackClass && (
        <div
          className={`${feedbackClass}${isCorrectFeedback ? " session-feedback--tappable" : ""}`}
          onClick={isCorrectFeedback ? onAdvance : undefined}
        >
          {isCorrectFeedback ? "Правильно!" : "Попробуем ещё раз…"}
          {isCorrectFeedback && (
            <div className="session-feedback__tap-hint">Нажмите, чтобы продолжить</div>
          )}
        </div>
      )}

      {Renderer && currentTask ? (
        <div
          className={`session-renderer-wrap${isCorrectFeedback ? " session-renderer-wrap--tappable" : ""}`}
          onClick={isCorrectFeedback ? onAdvance : undefined}
        >
          <Renderer
            key={`${taskIndex}_${sessionState.taskRetry ?? 0}`}
            task={currentTask}
            mode={mode}
            sessionStatus={status}
            topicId={topicRecord.meta.id}
            sessionParams={sessionParams}
            student={activeStudent}
            soundEnabled={soundEnabled}
            playFeedback={playFeedback}
            playTopicFile={playTopicFile}
            onCorrect={handleCorrect}
            onIncorrect={handleIncorrect}
            onMistake={handleMistake}
            onAdvance={onAdvance}
            onQualityAnswer={onQualityAnswer}
          />
        </div>
      ) : !rendererReady ? (
        <div className="screen-center">Загрузка…</div>
      ) : !Renderer ? (
        <div className="screen-center">
          Обновите тему «{topicRecord.meta.title ?? topicRecord.meta.id}» до актуальной версии —
          рендерер недоступен.
        </div>
      ) : (
        <div className="screen-center">Неизвестный рендерер: {topicRecord.meta.renderer}</div>
      )}
    </div>
  );
}
