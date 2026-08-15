import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { RENDERER_REGISTRY } from "@/topics/registry";
import { loadRenderer } from "@/topics/rendererLoader";
import { useSessionEngine } from "./useSessionEngine";
import { useLessonPlan } from "@/features/lessonPlan/LessonPlanContext";
import { useAudio } from "@/shared/hooks/useAudio";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import { getTopicTitle } from "@/shared/utils/format";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import SessionHeader from "./SessionHeader";
import SessionPlanDrawer from "@/features/lessonPlan/SessionPlanDrawer";
import { formatPlanTongueLabel } from "@/features/lessonPlan/lessonPlanUtils";
import { ADVANCE_GATE_IDLE, ADVANCE_GATE_WAITING, ADVANCE_GATE_READY, resolveTapAdvanceGate } from "./advanceGate";

const noop = () => {};

function isEditableTarget(target) {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export default function SessionScreen() {
  const setScreen             = useAppStore((s) => s.setScreen);
  const sessionReturnScreen    = useAppStore((s) => s.sessionReturnScreen);
  const setSessionReturnScreen = useAppStore((s) => s.setSessionReturnScreen);
  const activeLessonPlanItemId    = useAppStore((s) => s.activeLessonPlanItemId);
  const setActiveLessonPlanItemId = useAppStore((s) => s.setActiveLessonPlanItemId);
  const lessonPlan = useLessonPlan();
  const openSessionExitPrompt = useAppStore((s) => s.openSessionExitPrompt);
  const students              = useAppStore((s) => s.students);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const isStudentPortal          = useAppStore((s) => s.isStudentPortal);
  const adultConfirmAdvanceSaved = useAppStore((s) => s.settings.adultConfirmAdvance) ?? true;
  const adultConfirmAdvance      = isStudentPortal ? false : adultConfirmAdvanceSaved;
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
    completedRecord, rewardProgress, streakCount, answersPerStar,
    rewardPending, clearRewardPending,
    deckExhausted, handleRestartDeck, handleFinishDeck,
    onCorrect, onPrevious, onIncorrect, onMistake, onAdvance, onQualityAnswer,
    onCardShown, onTap, onQuality,
  } = useSessionEngine();

  const { soundEnabled, toggleSound, playFeedback, playTopicFile } = useAudio();
  const [manualAdvanceGate, setManualAdvanceGate] = useState({ key: null, state: null });
  const [isPlanDrawerOpen, setIsPlanDrawerOpen] = useState(false);
  const [pillFlash, setPillFlash] = useState(null);

  useEffect(() => {
    if (!pillFlash) return undefined;
    const timer = setTimeout(() => setPillFlash(null), 900);
    return () => clearTimeout(timer);
  }, [pillFlash]);

  function handleOpenModeSettings() {
    setIsPlanDrawerOpen(false);
    setSessionReturnScreen("session");
    setScreen("params");
  }

  useEffect(() => {
    if (!completedRecord) return;
    if (activeLessonPlanItemId) {
      lessonPlan?.markItemDone(activeLessonPlanItemId, true);
      setActiveLessonPlanItemId(null);
    }
    const skipSummary = topicRecord?.meta.renderer === "reading" && (mode?.type === "read_text" || mode?.type === "daily_sentences");
    const isInstruction = mode?.type === "follow_instruction" || mode?.type === "shopping_list" || mode?.type === "safe_code";
    if (isInstruction && sessionReturnScreen) {
      setScreen(sessionReturnScreen);
      setSessionReturnScreen(null);
      return;
    }
    setScreen(isInstruction ? "texts" : skipSummary ? "modes" : "summary");
  }, [completedRecord, activeLessonPlanItemId, lessonPlan, setActiveLessonPlanItemId, mode?.type, setScreen, topicRecord?.meta.renderer, sessionReturnScreen, setSessionReturnScreen]);

  const ownsFeedback = currentTask?.type === "choose_action" || currentTask?.type === "scene_function";

  // useCallback here isn't a perf nicety: some renderers (e.g. HouseGrow) key a
  // completion useEffect's setTimeout on this callback's identity via a `[done,
  // onCorrect, ...]` dependency array. A fresh function every render made that
  // effect tear down and refire on every SessionScreen re-render triggered by
  // its own onCorrect() call — a self-sustaining loop that ran correctCount
  // into the hundreds while the task never advanced (2026-07-27).
  const handleCorrect = useCallback((conceptId, cardId, options) => {
    if (!ownsFeedback) playFeedback("correct");
    if (mode?.evaluation === "instant") setPillFlash("correct");
    onCorrect(conceptId, cardId, options);
  }, [ownsFeedback, mode?.evaluation, playFeedback, onCorrect]);

  const handleIncorrect = useCallback((conceptId, cardId) => {
    if (!ownsFeedback) playFeedback("incorrect");
    onIncorrect(conceptId, cardId);
  }, [ownsFeedback, playFeedback, onIncorrect]);

  const handleMistake = useCallback((conceptId, cardId) => {
    if (!ownsFeedback) playFeedback("incorrect");
    onMistake(conceptId, cardId);
  }, [ownsFeedback, playFeedback, onMistake]);

  const handleFlashIncorrect = useCallback(() => {
    setPillFlash("incorrect");
  }, []);

  const handleQualityAnswer = useCallback((quality, conceptId, cardId) => {
    onQualityAnswer(quality, conceptId, cardId);
  }, [onQualityAnswer]);

  const { status, taskIndex, tasks, correctCount, incorrectCount } = sessionState ?? {};
  const isCorrectFeedback   = status === "answer_correct";
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

    const { gate, shouldAdvance } = resolveTapAdvanceGate(advanceGate, {
      adultConfirmAdvance,
      modeType: mode?.type,
    });
    setManualAdvanceGate(gate ? { key: advanceGateKey, state: gate } : { key: null, state: null });
    if (shouldAdvance) onAdvance();
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
        <div className="screen-center" style={{ gap: 16, padding: 24, textAlign: "center" }}>
          <div>Нет данных для сессии</div>
          <button className="btn btn--secondary" onClick={() => setScreen("home")}><BackArrowIcon size={16} /> На главную</button>
        </div>
      </div>
    );
  }

  const total = tasks.length;
  const isAdvanceGateActive = adultConfirmAdvance && advanceGate !== ADVANCE_GATE_IDLE;
  const isAdvanceReady = adultConfirmAdvance && advanceGate === ADVANCE_GATE_READY;
  const showStandaloneGate = isAdvanceGateActive && !isCorrectFeedback;
  const tongueAnswerStatus = pillFlash
    ? (pillFlash === "correct" ? "answer_correct" : "answer_incorrect")
    : status;

  const topicTitle = getTopicTitle(topicRecord.meta.title) || topicRecord.meta.id;
  const modeTitle  = getTopicTitle(mode.ui?.title) || mode.id;

  const isNavigatorFlashCards = topicRecord.meta.id === "symmetry_draw"
    && mode.id === "navigator_learning"
    && sessionParams.learningExercise === "cards";
  const showStreak = mode?.type !== "daily_sentences" && !isNavigatorFlashCards;
  const showProgress = !(
    (topicRecord.meta.renderer === "reading" && (currentTask?.text?.kind === "story" || currentTask?.text?.kind === "poem"))
    || topicRecord.meta.renderer === "print_materials"
  );

  return (
    <div className="session-screen">
      <div className="session-header-wrap">
        <SessionHeader
          topicTitle={topicTitle}
          modeTitle={modeTitle}
          showProgress={showProgress}
          showStreak={showStreak}
          streakCount={streakCount}
          rewardAvailable={rewardProgress?.available ?? false}
          answersPerStar={answersPerStar}
          taskIndex={taskIndex}
          total={total}
          correctCount={correctCount}
          incorrectCount={incorrectCount}
          answerStatus={tongueAnswerStatus}
          evaluation={mode.evaluation}
          onClose={openSessionExitPrompt}
          tongueLabel={formatPlanTongueLabel(lessonPlan?.activeSessionPlan ?? null)}
          hasUndonePlanItems={(lessonPlan?.activeSessionPlan?.items ?? []).some((item) => !item.done)}
          isDrawerOpen={isPlanDrawerOpen}
          onSetDrawerOpen={setIsPlanDrawerOpen}
        />
        <SessionPlanDrawer
          isOpen={isPlanDrawerOpen}
          onClose={() => setIsPlanDrawerOpen(false)}
          modeTitle={modeTitle}
          onOpenModeSettings={handleOpenModeSettings}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          isStudentPortal={isStudentPortal}
          adultConfirmAdvance={adultConfirmAdvance}
          lockHoldProgress={lockHoldProgress}
          lockFlash={lockFlash}
          onLockPointerDown={startLockHold}
          onLockPointerUp={cancelLockHold}
        />
      </div>

      {Renderer && currentTask ? (
        <div
          className={`session-renderer-wrap${(isCorrectFeedback && (!adultConfirmAdvance || isAdvanceReady)) || isAdvanceReady ? " session-renderer-wrap--tappable" : ""}`}
          onClick={(isCorrectFeedback || isAdvanceGateActive) ? requestAdvance : undefined}
        >
          <Renderer
            key={`${taskIndex}_${sessionState.taskRetry ?? 0}`}
            task={currentTask}
            taskRetry={sessionState.taskRetry ?? 0}
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
            onPrevious={onPrevious}
            onIncorrect={isAdvanceGateActive ? noop : handleIncorrect}
            onMistake={isAdvanceGateActive ? noop : handleMistake}
            onFlashIncorrect={isAdvanceGateActive ? noop : handleFlashIncorrect}
            onAdvance={requestAdvance}
            onQualityAnswer={isAdvanceGateActive ? noop : handleQualityAnswer}
            onClose={openSessionExitPrompt}
            onCardShown={onCardShown}
            onTap={onTap}
            onQuality={onQuality}
            streakCount={streakCount}
            answersPerStar={answersPerStar}
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
            <BackArrowIcon size={16} /> Назад к понятиям
          </button>
        </div>
      ) : (
        <div className="screen-center">Неизвестный рендерер: {topicRecord.meta.renderer}</div>
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
