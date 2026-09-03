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

export function shouldShowSessionStreak({ mode, isNavigatorFlashCards, renderer, rewardAvailable }) {
  if (mode?.type === "daily_sentences" || isNavigatorFlashCards) return false;
  // Spatial-prepositions sessions normally keep the header minimal.  An
  // evaluated spatial mode with video rewards is the exception: without the
  // bar, the child cannot see the progress that unlocks the reward.
  if (renderer === "spatial_prepositions") {
    return mode?.evaluation !== "none" && rewardAvailable;
  }
  return true;
}

// This renderer is maintained by the application itself.  Older versions of
// its ZIP used to ship a renderer.js; if one remains in IndexedDB it must not
// override the current bundled component after the topic has been updated.
export function shouldPreferBundledRenderer(renderer) {
  return renderer === "spatial_prepositions";
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
    completedRecord, rewardProgress, streakCount, bestStreak, answersPerStar,
    rewardPending, clearRewardPending,
    deckExhausted, handleRestartDeck, handleFinishDeck,
    onCorrect, onPrevious, onIncorrect, onMistake, onAdvance, onQualityAnswer,
    onCardShown, onTap, onQuality,
  } = useSessionEngine();

  const { soundEnabled, toggleSound, playFeedback, playTopicFile, isAudioPlaying } = useAudio();
  const pendingAudioAdvanceRef = useRef(null);
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
    // read_text/daily_sentences are unscored (evaluation: "none"), so a stars
    // summary has nothing to show — but landing on the mode picker afterward
    // (rather than just going home, like closing mid-session already does)
    // turned out to be an unwanted extra stop, not a useful "pick the next
    // mode for this text" nudge. Go straight home instead.
    const skipSummary = topicRecord?.meta.renderer === "reading" && (mode?.type === "read_text" || mode?.type === "daily_sentences");
    const isInstruction = mode?.type === "follow_instruction" || mode?.type === "shopping_list" || mode?.type === "safe_code";
    if (isInstruction && sessionReturnScreen) {
      setScreen(sessionReturnScreen);
      setSessionReturnScreen(null);
      return;
    }
    setScreen(isInstruction ? "texts" : skipSummary ? "home" : "summary");
  }, [completedRecord, activeLessonPlanItemId, lessonPlan, setActiveLessonPlanItemId, mode?.type, setScreen, topicRecord?.meta.renderer, sessionReturnScreen, setSessionReturnScreen]);

  // word_agreement plays its own recorded word audio in place of the
  // generic correct/incorrect chime (see FillBlankTask's playCorrectAudio) —
  // without this, playFeedback's stop() raced playTopicFile's in-flight
  // getDb()/getFile() and cancelled it via the shared genRef token before it
  // ever reached Audio.play(), so the recorded word silently never played.
  const OWNS_FEEDBACK_TYPES = new Set([
    "choose_action", "scene_function",
    "case_agreement", "verb_number", "verb_gender",
    "numeral_agreement", "adjective_agreement", "possessive_agreement",
    "preposition_recognize", "preposition_place", "preposition_phrase",
    "operation_observe",
  ]);
  const ownsFeedback = OWNS_FEEDBACK_TYPES.has(currentTask?.type);

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
    if (!shouldAdvance) return;

    // For renderers that play their own recorded audio in place of the
    // generic chime (word_agreement's card word, see ownsFeedback above),
    // a tap right after a correct answer used to cut that audio off and
    // jump straight to the next card. Queue the advance instead — it fires
    // the moment playback ends rather than mid-word.
    if (ownsFeedback && isAudioPlaying()) {
      if (pendingAudioAdvanceRef.current) return; // already queued from an earlier tap
      pendingAudioAdvanceRef.current = setInterval(() => {
        if (isAudioPlaying()) return;
        clearInterval(pendingAudioAdvanceRef.current);
        pendingAudioAdvanceRef.current = null;
        onAdvance();
      }, 100);
      return;
    }
    onAdvance();
  }, [adultConfirmAdvance, advanceGate, advanceGateKey, mode?.type, onAdvance, ownsFeedback, isAudioPlaying]);

  useEffect(() => () => {
    if (pendingAudioAdvanceRef.current) clearInterval(pendingAudioAdvanceRef.current);
  }, []);

  // Dynamic renderer: use a topic-supplied renderer.js when appropriate,
  // otherwise fall back to the renderer bundled with the app.
  const [Renderer, setRenderer]           = useState(() =>
    topicRecord ? (RENDERER_REGISTRY[topicRecord.meta.renderer] ?? null) : null
  );
  const [rendererReady, setRendererReady] = useState(
    () => !!(topicRecord && RENDERER_REGISTRY[topicRecord.meta.renderer])
  );
  useEffect(() => {
    if (!topicRecord) return;
    const { renderer: rendererId } = topicRecord.meta;

    if (shouldPreferBundledRenderer(rendererId)) {
      setRenderer(() => RENDERER_REGISTRY[rendererId] ?? null);
      setRendererReady(true);
      return undefined;
    }

    loadRenderer(topicRecord.meta.id)
      .then((DynamicRenderer) => {
        setRenderer(() => DynamicRenderer ?? RENDERER_REGISTRY[rendererId] ?? null);
      })
      .catch(() => {
        setRenderer(() => RENDERER_REGISTRY[rendererId] ?? null);
      })
      .finally(() => setRendererReady(true));
  }, [topicRecord?.meta.id, topicRecord?.meta.renderer]);

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
  // A graphic dictation consists of several dependent strokes. An error on
  // the current stroke is recorded in the session (including strict-stars),
  // but must not remount the renderer: the already completed figure remains
  // the child's visual and motor reference for the retry.
  const keepsDictationCanvasOnMistake = topicRecord.meta.id === "symmetry_draw"
    && ["graphic_dictation", "coordinate_dictation"].includes(currentTask?.type);
  // The first operations mode replays the exact same visual scene after an
  // error. Remounting it would discard its gentle "Посмотри ещё раз" feedback
  // before the replay begins.
  const keepsObserveSceneOnMistake = currentTask?.type === "operation_observe";
  const rendererTaskKey = keepsDictationCanvasOnMistake || keepsObserveSceneOnMistake
    ? String(taskIndex)
    : `${taskIndex}_${sessionState.taskRetry ?? 0}`;
  const showStreak = shouldShowSessionStreak({
    mode,
    isNavigatorFlashCards,
    renderer: topicRecord.meta.renderer,
    rewardAvailable: rewardProgress?.available ?? false,
  });
  const showProgress = !(
    (topicRecord.meta.renderer === "reading" && (currentTask?.text?.kind === "story" || currentTask?.text?.kind === "poem"))
    || topicRecord.meta.renderer === "print_materials"
    || topicRecord.meta.renderer === "spatial_prepositions"
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
            key={rendererTaskKey}
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
            bestStreak={bestStreak}
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

      {deckExhausted && !topicRecord?.meta?.loopModes && (
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
