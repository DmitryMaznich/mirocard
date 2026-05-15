import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { RENDERER_REGISTRY } from "@/topics/registry";
import { loadRenderer } from "@/topics/rendererLoader";
import { useSessionEngine } from "./useSessionEngine";
import { useAudio } from "@/shared/hooks/useAudio";
import ProgressBar from "@/shared/components/ProgressBar";
import { getTopicTitle } from "@/shared/utils/format";

const ADVANCE_GATE_IDLE = "idle";
const ADVANCE_GATE_WAITING = "waiting";
const ADVANCE_GATE_READY = "ready";

function isEditableTarget(target) {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export default function SessionScreen() {
  const setScreen       = useAppStore((s) => s.setScreen);
  const students        = useAppStore((s) => s.students);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const adultConfirmAdvance = useAppStore((s) => s.settings.adultConfirmAdvance ?? true);
  const activeStudent   = students.find((s) => s.id === activeStudentId) ?? null;

  const {
    sessionState, currentTask, mode, topicRecord, sessionParams,
    completedRecord, rewardProgress, onCorrect, onIncorrect, onMistake, onAdvance, onQualityAnswer,
  } = useSessionEngine();

  const { soundEnabled, toggleSound, playFeedback, playTopicFile } = useAudio();
  const [manualAdvanceGate, setManualAdvanceGate] = useState({ key: null, state: null });

  useEffect(() => {
    if (!completedRecord) return;
    const skipSummary = topicRecord?.meta.renderer === "reading" && mode?.type === "read_text";
    const isInstruction = mode?.type === "follow_instruction";
    setScreen(isInstruction ? "texts" : skipSummary ? "modes" : "summary");
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

  const { status, taskIndex, tasks, correctCount, incorrectCount } = sessionState ?? {};
  const isCorrectFeedback   = status === "answer_correct";
  const isIncorrectFeedback = status === "answer_incorrect";
  const advanceGateKey = `${taskIndex ?? "none"}:${status ?? "none"}`;
  const defaultAdvanceGate = adultConfirmAdvance && isCorrectFeedback
    ? ADVANCE_GATE_WAITING
    : ADVANCE_GATE_IDLE;
  const advanceGate = adultConfirmAdvance && manualAdvanceGate.key === advanceGateKey
    ? manualAdvanceGate.state
    : defaultAdvanceGate;

  useEffect(() => {
    if (!adultConfirmAdvance || advanceGate !== ADVANCE_GATE_WAITING) return undefined;

    function handleKeyDown(event) {
      if (event.repeat) return;
      if (event.key !== " " && event.key !== "Spacebar" && event.key !== "Enter") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      setManualAdvanceGate({ key: advanceGateKey, state: ADVANCE_GATE_READY });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [adultConfirmAdvance, advanceGate, advanceGateKey]);

  const requestAdvance = useCallback((event) => {
    event?.stopPropagation?.();

    if (!adultConfirmAdvance || advanceGate === ADVANCE_GATE_READY || mode?.type === "follow_instruction") {
      setManualAdvanceGate({ key: null, state: null });
      onAdvance();
      return;
    }

    setManualAdvanceGate({ key: advanceGateKey, state: ADVANCE_GATE_WAITING });
  }, [adultConfirmAdvance, advanceGate, advanceGateKey, mode?.type, onAdvance]);

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

  const total = tasks.length;
  const isAdvanceGateActive = adultConfirmAdvance && advanceGate !== ADVANCE_GATE_IDLE;
  const isAdvanceReady = adultConfirmAdvance && advanceGate === ADVANCE_GATE_READY;
  const advanceFeedbackHint = adultConfirmAdvance
    ? (isAdvanceReady ? "Можно продолжить" : "Ждем подтверждения")
    : "Нажмите, чтобы продолжить";
  const advanceGateLabel = isAdvanceReady ? "Можно продолжить" : "Ждем подтверждения";
  const showStandaloneGate = isAdvanceGateActive && !isCorrectFeedback;

  const feedbackClass =
    isCorrectFeedback   ? "session-feedback session-feedback--correct"
  : isIncorrectFeedback ? "session-feedback session-feedback--incorrect"
  : "";

  const topicTitle = getTopicTitle(topicRecord.meta.title) || topicRecord.meta.id;
  const modeTitle  = getTopicTitle(mode.ui?.title) || mode.id;

  return (
    <div className="session-screen">
      <div className="session-topbar">
        <div className="session-topbar-controls">
          <ProgressBar
            value={rewardProgress?.completed ?? taskIndex}
            max={total}
            className="session-progress"
            reward={rewardProgress}
          />
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
          className={`${feedbackClass}${isCorrectFeedback && (!adultConfirmAdvance || isAdvanceReady) ? " session-feedback--tappable" : ""}${isCorrectFeedback && adultConfirmAdvance ? ` session-feedback--confirm-${advanceGate}` : ""}`}
          onClick={isCorrectFeedback ? requestAdvance : undefined}
        >
          {isCorrectFeedback ? "Правильно!" : "Попробуем ещё раз…"}
          {isCorrectFeedback && (
            <div className="session-feedback__tap-hint">
              {advanceFeedbackHint}
              {isAdvanceReady && adultConfirmAdvance && (
                <span className="session-feedback__tap-subhint">Нажмите, чтобы продолжить</span>
              )}
            </div>
          )}
        </div>
      )}

      {showStandaloneGate && (
        <div
          className={`session-advance-gate${isAdvanceReady ? " session-advance-gate--ready" : ""}`}
          onClick={isAdvanceReady ? requestAdvance : undefined}
        >
          {advanceGateLabel}
          {isAdvanceReady && <span>Нажмите, чтобы продолжить</span>}
        </div>
      )}

      {Renderer && currentTask ? (
        <div
          className={`session-renderer-wrap${(isCorrectFeedback && (!adultConfirmAdvance || isAdvanceReady)) || isAdvanceReady ? " session-renderer-wrap--tappable" : ""}`}
          onClick={(isCorrectFeedback || isAdvanceGateActive) ? requestAdvance : undefined}
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
            onAdvance={requestAdvance}
            onQualityAnswer={onQualityAnswer}
          />
        </div>
      ) : !rendererReady ? (
        <div className="screen-center">Загрузка…</div>
      ) : !Renderer ? (
        <div className="screen-center">
          Обновите тему «{getTopicTitle(topicRecord.meta.title) || topicRecord.meta.id}» до актуальной версии —
          рендерер недоступен.
        </div>
      ) : sessionState?.tasks.length === 0 ? (
        <div className="screen-center" style={{ gap: 16, padding: 24, textAlign: "center" }}>
          <div>Для выбранных понятий нет подходящих предложений.</div>
          <div>Попробуйте выбрать другие понятия.</div>
          <button className="btn btn--secondary" style={{ marginTop: 8 }} onClick={() => setScreen("concepts")}>
            ← Назад к понятиям
          </button>
        </div>
      ) : (
        <div className="screen-center">Неизвестный рендерер: {topicRecord.meta.renderer}</div>
      )}
    </div>
  );
}
