import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { RENDERER_REGISTRY } from "@/topics/registry";
import { loadRenderer } from "@/topics/rendererLoader";
import { useSessionEngine } from "./useSessionEngine";
import { useAudio } from "@/shared/hooks/useAudio";
import StarBar from "@/shared/components/StarBar";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import { getTopicTitle } from "@/shared/utils/format";

const ADVANCE_GATE_IDLE = "idle";
const ADVANCE_GATE_WAITING = "waiting";
const ADVANCE_GATE_READY = "ready";
const noop = () => {};

function isEditableTarget(target) {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export default function SessionScreen() {
  const setScreen             = useAppStore((s) => s.setScreen);
  const openSessionExitPrompt = useAppStore((s) => s.openSessionExitPrompt);
  const students              = useAppStore((s) => s.students);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const adultConfirmAdvance = useAppStore((s) => s.settings.adultConfirmAdvance ?? true);
  const settings        = useAppStore((s) => s.settings);
  const patchSettings   = useAppStore((s) => s.patchSettings);
  const activeStudent   = students.find((s) => s.id === activeStudentId) ?? null;

  const LOCK_HOLD_MS = 5000;
  const lockIntervalRef  = useRef(null);
  const lockStartRef     = useRef(null);
  const [lockHoldProgress, setLockHoldProgress] = useState(0);
  const [lockFlash, setLockFlash] = useState(null);

  useEffect(() => () => {
    if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
  }, []);

  function startLockHold() {
    if (lockIntervalRef.current) return;
    lockStartRef.current = Date.now();
    lockIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lockStartRef.current;
      const pct = Math.min((elapsed / LOCK_HOLD_MS) * 100, 100);
      setLockHoldProgress(pct);
      if (pct >= 100) {
        clearInterval(lockIntervalRef.current);
        lockIntervalRef.current = null;
        setLockHoldProgress(0);
        const next = !adultConfirmAdvance;
        patchSettings({ adultConfirmAdvance: next });
        getDb().then((db) => kv.set(db, "settings", { ...settings, adultConfirmAdvance: next }));
        setLockFlash(next ? "locked" : "unlocked");
        setTimeout(() => setLockFlash(null), 1800);
      }
    }, 40);
  }

  function cancelLockHold() {
    if (lockIntervalRef.current) {
      clearInterval(lockIntervalRef.current);
      lockIntervalRef.current = null;
    }
    setLockHoldProgress(0);
  }

  const {
    sessionState, currentTask, mode, topicRecord, sessionParams,
    completedRecord, rewardProgress, streakCount,
    rewardPending, clearRewardPending,
    deckExhausted, handleRestartDeck, handleFinishDeck,
    onCorrect, onIncorrect, onMistake, onAdvance, onQualityAnswer,
    onCardShown, onTap, onQuality,
  } = useSessionEngine();

  const { soundEnabled, toggleSound, playFeedback, playTopicFile } = useAudio();
  const [manualAdvanceGate, setManualAdvanceGate] = useState({ key: null, state: null });

  useEffect(() => {
    if (!completedRecord) return;
    const skipSummary = topicRecord?.meta.renderer === "reading" && mode?.type === "read_text";
    const isInstruction = mode?.type === "follow_instruction";
    setScreen(isInstruction ? "texts" : skipSummary ? "modes" : "summary");
  }, [completedRecord, mode?.type, setScreen, topicRecord?.meta.renderer]);

  const ownsFeedback = currentTask?.type === "choose_action" || currentTask?.type === "scene_function";

  function handleCorrect(conceptId, cardId) {
    if (!ownsFeedback) playFeedback("correct");
    onCorrect(conceptId, cardId);
  }

  function handleIncorrect(conceptId, cardId) {
    if (!ownsFeedback) playFeedback("incorrect");
    onIncorrect(conceptId, cardId);
  }

  function handleMistake(conceptId, cardId) {
    if (!ownsFeedback) playFeedback("incorrect");
    onMistake(conceptId, cardId);
  }

  function handleQualityAnswer(quality, conceptId, cardId) {
    onQualityAnswer(quality, conceptId, cardId);
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
    let didAdvance = false;

    function handleKeyDown(event) {
      if (event.repeat) return;
      if (event.key !== " " && event.key !== "Spacebar" && event.key !== "Enter") return;
      if (isEditableTarget(event.target)) return;
      if (didAdvance) return;
      didAdvance = true;
      event.preventDefault();
      setManualAdvanceGate({ key: null, state: null });
      onAdvance();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [adultConfirmAdvance, advanceGate, onAdvance]);

  const requestAdvance = useCallback((event) => {
    event?.stopPropagation?.();

    if (!adultConfirmAdvance || advanceGate === ADVANCE_GATE_READY || mode?.type === "follow_instruction" || mode?.type === "listen_write_letters" || mode?.type === "magnetic_sentence" || mode?.type === "magnetic_sentence_audio" || mode?.type === "sort_letters" || mode?.type === "story_sequence" || mode?.type === "letter_demo" || mode?.type === "letter_follow" || mode?.type === "letter_trace") {
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
  const showStandaloneGate = isAdvanceGateActive && !isCorrectFeedback;

  const topicTitle = getTopicTitle(topicRecord.meta.title) || topicRecord.meta.id;
  const modeTitle  = getTopicTitle(mode.ui?.title) || mode.id;

  return (
    <div className="session-screen">
      <div className="session-topbar">
        <div className="session-topbar-controls">
          <StarBar
            className="session-progress"
            streakCount={streakCount}
            available={rewardProgress?.available ?? false}
          />
          <div className="session-topbar-right">
            {!sessionState?.isDeckMode && (
              <div className="session-counter">
                {taskIndex + 1} / {total}
                {mode.evaluation !== "none" && (
                  <span className="session-score">  ✓{correctCount}  ✗{incorrectCount}</span>
                )}
              </div>
            )}
            <button
              className={`session-audio-icon-button${soundEnabled ? " session-audio-icon-button--active" : ""}`}
              onClick={toggleSound}
              aria-label={soundEnabled ? "Выключить звук" : "Включить звук"}
            >
              <span className="session-audio-speaker-icon">
                {soundEnabled ? "🔊" : "🔇"}
              </span>
            </button>
            <button
              className="session-lock-btn"
              style={{ "--lock-p": lockHoldProgress }}
              onPointerDown={startLockHold}
              onPointerUp={cancelLockHold}
              onPointerLeave={cancelLockHold}
              onPointerCancel={cancelLockHold}
              onContextMenu={(e) => e.preventDefault()}
              aria-label={adultConfirmAdvance ? "Снять блокировку (удержать)" : "Включить блокировку (удержать)"}
            >
              <span className="session-lock-btn__icon">
                {adultConfirmAdvance ? "🔒" : "🔓"}
              </span>
              {lockFlash && (
                <span className={`session-lock-flash session-lock-flash--${lockFlash}`}>
                  {lockFlash === "locked" ? "Блок." : "Снято"}
                </span>
              )}
            </button>
            <button className="session-finish-btn" onClick={openSessionExitPrompt}>✕</button>
          </div>
        </div>
        <div className="session-subtitle">{topicTitle} · {modeTitle}</div>
      </div>

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
            topicRecord={topicRecord}
            sessionParams={sessionParams}
            student={activeStudent}
            soundEnabled={soundEnabled}
            playFeedback={playFeedback}
            playTopicFile={playTopicFile}
            onCorrect={isAdvanceGateActive ? noop : handleCorrect}
            onIncorrect={isAdvanceGateActive ? noop : handleIncorrect}
            onMistake={isAdvanceGateActive ? noop : handleMistake}
            onAdvance={requestAdvance}
            onQualityAnswer={isAdvanceGateActive ? noop : handleQualityAnswer}
            onCardShown={onCardShown}
            onTap={onTap}
            onQuality={onQuality}
            streakCount={streakCount}
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

      {isIncorrectFeedback && !ownsFeedback && (
        <div className="session-fb-overlay session-fb-overlay--incorrect" aria-hidden="true">
          <span className="session-fb-overlay__icon">✕</span>
        </div>
      )}

      {isCorrectFeedback && !ownsFeedback && (
        <div
          className={`session-fb-overlay session-fb-overlay--correct${!adultConfirmAdvance || isAdvanceReady ? " session-fb-overlay--ready" : ""}`}
          onClick={requestAdvance}
        >
          <span className="session-fb-overlay__icon">✓</span>
          {(!adultConfirmAdvance || isAdvanceReady) && (
            <span className="session-fb-overlay__hint">Нажмите, чтобы продолжить</span>
          )}
        </div>
      )}

      {showStandaloneGate && (
        <div
          className={`session-fb-overlay session-fb-overlay--gate${isAdvanceReady ? " session-fb-overlay--ready" : ""}`}
          onClick={isAdvanceReady ? requestAdvance : undefined}
        >
          {isAdvanceReady ? "Можно продолжить" : "Ждём подтверждения"}
          {isAdvanceReady && <span className="session-fb-overlay__hint">Нажмите, чтобы продолжить</span>}
        </div>
      )}

      {rewardPending && activeStudent && (
        <RewardVideoModal
          rewardVideos={activeStudent.rewardVideos ?? []}
          studentId={activeStudent.id}
          onDismiss={clearRewardPending}
        />
      )}

      {deckExhausted && (
        <div className="deck-exhausted-overlay">
          <div className="deck-exhausted-dialog">
            <div className="deck-exhausted-dialog__icon">🎉</div>
            <div className="deck-exhausted-dialog__title">Вы прошли все карточки!</div>
            <div className="deck-exhausted-dialog__actions">
              <button className="deck-exhausted-dialog__btn" onClick={handleRestartDeck}>
                Начать снова
              </button>
              <button className="deck-exhausted-dialog__btn deck-exhausted-dialog__btn--finish" onClick={handleFinishDeck}>
                Завершить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
