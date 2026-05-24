// src/topics/renderers/function_cards/index.jsx
import { useState, useEffect, useRef } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import FlashcardsRenderer from "@/topics/renderers/flashcards";
import "./function_cards.css";

// ── ToolImage ────────────────────────────────────────────────
function ToolImage({ topicId, card, className = "" }) {
  const url = useTopicFile(topicId, card?.image);
  if (!card?.image) return null;
  if (!url) return <div className={`fc-img fc-img--loading ${className}`} />;
  return <img className={`fc-img ${className}`} src={url} alt="" draggable={false} />;
}

// ── SceneImage ───────────────────────────────────────────────
function SceneImage({ topicId, card, blurred, className = "" }) {
  const url = useTopicFile(topicId, card?.image);
  if (!card?.image || !url) return <div className={`fc-scene-img fc-scene-img--loading ${className}`} />;
  return (
    <img
      className={`fc-scene-img ${blurred ? "fc-scene-img--blurred" : ""} ${className}`}
      src={url}
      alt=""
      draggable={false}
    />
  );
}

const ETA_GAP = 670;      // ms between "Это" and tool name audio
const Q_INTRO_GAP = 1260; // ms between "Для чего нужен" and tool name audio

// ── FunctionIntroTask ─────────────────────────────────────────
// Audio durations for tap-lock: "Это" (~600ms) + gap + tool name (~900ms) ≈ 2200ms total
const ETA_LOCK_MS      = ETA_GAP + 900;   // lock after playEta starts
const Q_LOCK_MS        = Q_INTRO_GAP + 900; // lock after playQuestion starts

function FunctionIntroTask({ task, topicId, soundEnabled, playTopicFile, onAdvance }) {
  // steps: 0=tool+audio, 1=question, 2=process scene+feedback, 3=result scene+feedback
  const maxStep = task.sceneProcessCard ? 3 : 2;

  const [step, setStep] = useState(0);
  const pendingRef  = useRef(null);
  const tapLockRef  = useRef(null); // blocks taps while audio plays

  function clearPending() {
    if (pendingRef.current) { clearTimeout(pendingRef.current); pendingRef.current = null; }
  }

  function lockTaps(ms) {
    if (tapLockRef.current) clearTimeout(tapLockRef.current);
    tapLockRef.current = setTimeout(() => { tapLockRef.current = null; }, ms);
  }

  useEffect(() => {
    clearPending();
    setStep(0);
    playEta();
    return () => {
      clearPending();
      if (tapLockRef.current) { clearTimeout(tapLockRef.current); tapLockRef.current = null; }
    };
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === 1) playQuestion();
    if (step === 2 && soundEnabled && task.feedbackAudio) {
      playTopicFile(topicId, task.feedbackAudio);
      lockTaps(1800);
    }
    if (step === 3 && soundEnabled && task.closingAudio) {
      playTopicFile(topicId, task.closingAudio);
      lockTaps(900);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  function playEta() {
    if (!soundEnabled) return;
    if (task.etaAudio) {
      playTopicFile(topicId, task.etaAudio);
      if (task.toolNameAudio) pendingRef.current = setTimeout(() => playTopicFile(topicId, task.toolNameAudio), ETA_GAP);
      lockTaps(ETA_LOCK_MS);
    } else if (task.toolNameAudio) {
      playTopicFile(topicId, task.toolNameAudio);
      lockTaps(900);
    }
  }

  function playQuestion() {
    if (!soundEnabled) return;
    if (task.questionPrefixAudio) {
      playTopicFile(topicId, task.questionPrefixAudio);
      if (task.toolNameAudio) pendingRef.current = setTimeout(() => playTopicFile(topicId, task.toolNameAudio), Q_INTRO_GAP);
      lockTaps(Q_LOCK_MS);
    } else if (task.toolNameAudio) {
      playTopicFile(topicId, task.toolNameAudio);
      lockTaps(900);
    }
  }

  function handleTap() {
    if (tapLockRef.current) return; // audio still playing
    clearPending();
    if (step < maxStep) setStep(s => s + 1);
    else onAdvance?.();
  }

  const sceneCard = step === 2 && task.sceneProcessCard
    ? task.sceneProcessCard
    : task.sceneAfterCard;

  return (
    <div className={`fc-intro fc-intro--step-${step} session-body`} onClick={handleTap}>
      {step === 0 && (
        <>
          <div className="fc-intro-tool-wrap">
            <ToolImage topicId={topicId} card={task.toolCard} />
          </div>
          <div className="fc-intro-label">
            <span>{task.label}</span>
            {soundEnabled && (task.etaAudio || task.toolNameAudio) && (
              <button className="fc-ca-audio-btn" onClick={e => { e.stopPropagation(); playEta(); }} aria-label="Повторить">🔊</button>
            )}
          </div>
        </>
      )}

      {step === 1 && (
        <div className="fc-intro-question-wrap">
          <p className="fc-intro-question">{task.question}</p>
          {soundEnabled && (task.questionPrefixAudio || task.toolNameAudio) && (
            <button className="fc-ca-audio-btn fc-intro-q-audio-btn" onClick={e => { e.stopPropagation(); playQuestion(); }} aria-label="Повторить вопрос">🔊</button>
          )}
        </div>
      )}

      {step >= 2 && (
        <>
          <div className="fc-intro-scene-wrap">
            <SceneImage topicId={topicId} card={sceneCard} blurred={false} />
          </div>
          <p className="fc-intro-feedback">
            {step === 3 ? "Вот так!" : task.feedbackText}
          </p>
        </>
      )}
    </div>
  );
}

const Q_AUDIO_GAP = 1680; // ms between prefix phrase and tool name audio (~1s for phrase to finish)

// ── ChooseActionTask ─────────────────────────────────────────
function ChooseActionTask({ task, topicId, soundEnabled, playTopicFile, onCorrect, onIncorrect, playFeedback }) {
  const [selected, setSelected] = useState(null);
  const [phase, setPhase] = useState("question"); // "question" | "feedback" | "scene"
  const pendingRef = useRef(null);
  const toolUrl = useTopicFile(topicId, task.toolCard?.image);

  function clearPending() {
    if (pendingRef.current) { clearTimeout(pendingRef.current); pendingRef.current = null; }
  }

  useEffect(() => {
    clearPending();
    setSelected(null);
    setPhase("question");
    if (soundEnabled) playQuestion();
    return clearPending;
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  function playQuestion() {
    if (!soundEnabled) return;
    if (task.questionPrefixAudio) {
      playTopicFile(topicId, task.questionPrefixAudio);
      if (task.toolNameAudio) pendingRef.current = setTimeout(() => playTopicFile(topicId, task.toolNameAudio), Q_AUDIO_GAP);
    } else if (task.toolNameAudio) {
      playTopicFile(topicId, task.toolNameAudio);
    }
  }

  function handleSelect(option) {
    if (selected !== null) return;
    clearPending();
    setSelected(option);
    setPhase("feedback");
    if (soundEnabled) playFeedback(option.isTarget ? "correct" : "incorrect");
    pendingRef.current = setTimeout(() => {
      setPhase("scene");
      if (option.isTarget) onCorrect(task.conceptId, task.toolCard?.id ?? null);
      else                 onIncorrect(task.conceptId, task.toolCard?.id ?? null);
    }, 1000);
  }

  if (phase === "scene") {
    return (
      <div className="session-body fc-ca-reveal">
        <div className="fc-intro-scene-wrap">
          <SceneImage topicId={topicId} card={task.sceneProcessCard ?? task.sceneAfterCard} blurred={false} />
        </div>
        <p className="fc-intro-feedback">{task.feedbackText}</p>
      </div>
    );
  }

  return (
    <div className="session-body fc-choose-action">
      <div className="card-area">
        {toolUrl
          ? <img className="card-img" src={toolUrl} alt="" draggable={false} style={{ objectFit: "contain" }} />
          : <div className="card-img card-img--loading" />
        }
      </div>
      <div className="fc-ca-right">
        <div className="fc-ca-question-row">
          <span className="session-instruction">{task.question}</span>
          {soundEnabled && (task.questionPrefixAudio || task.toolNameAudio) && (
            <button className="fc-ca-audio-btn" onClick={playQuestion} aria-label="Повторить вопрос">🔊</button>
          )}
        </div>
        <div className="choose-word-options">
          {task.options.map(opt => (
            <button key={opt.conceptId} className="choose-word-btn" onClick={() => handleSelect(opt)}>
              {opt.actionInf}
            </button>
          ))}
        </div>
      </div>
      {phase === "feedback" && selected && (
        <div
          className={`session-fb-overlay session-fb-overlay--${selected.isTarget ? "correct" : "incorrect"} session-fb-overlay--ready`}
          aria-hidden="true"
        >
          <span className="session-fb-overlay__icon">{selected.isTarget ? "✓" : "✕"}</span>
        </div>
      )}
    </div>
  );
}

// ── ToolOption (for SceneFunctionTask) ───────────────────────
function ToolOption({ option, topicId, selected, onSelect }) {
  let mod = "";
  if (selected !== null) {
    if (option.isTarget) mod = "fc-tool-opt--correct";
    else if (selected.conceptId === option.conceptId) mod = "fc-tool-opt--wrong";
  }
  return (
    <button
      className={`fc-tool-opt ${mod}`}
      onClick={() => onSelect(option)}
      disabled={selected !== null}
    >
      <ToolImage topicId={topicId} card={option.toolCard} />
      <span className="fc-tool-opt-label">{option.label}</span>
    </button>
  );
}

// ── SceneFunctionTask ─────────────────────────────────────────
function SceneFunctionTask({ task, topicId, soundEnabled, playFeedback, onCorrect, onMistake, mode }) {
  const [selected, setSelected] = useState(null);
  const [phase, setPhase]       = useState("question"); // "question" | "feedback" | "scene"
  const pendingRef = useRef(null);

  function clearPending() {
    if (pendingRef.current) { clearTimeout(pendingRef.current); pendingRef.current = null; }
  }

  useEffect(() => {
    clearPending();
    setSelected(null);
    setPhase("question");
    return clearPending;
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(option) {
    if (selected !== null) return;
    clearPending();
    setSelected(option);
    setPhase("feedback");
    if (soundEnabled) playFeedback(option.isTarget ? "correct" : "incorrect");
    if (!option.isTarget) {
      onMistake?.(task.conceptId, null);
      pendingRef.current = setTimeout(() => {
        setSelected(null);
        setPhase("question");
      }, 800);
    } else {
      pendingRef.current = setTimeout(() => {
        setPhase("scene");
        onCorrect(task.conceptId, null);
      }, 1000);
    }
  }

  if (phase === "scene") {
    return (
      <div className="session-body fc-sf-reveal">
        <div className="fc-sf-after-wrap">
          <SceneImage topicId={topicId} card={task.sceneProcess ?? task.sceneAfter} blurred={false} />
        </div>
        {task.feedbackText && (
          <p className="fc-sf-feedback">{task.feedbackText}</p>
        )}
      </div>
    );
  }

  return (
    <div className="fc-scene-function session-body">
      <div className="fc-scenes">
        <div className="fc-scene">
          <SceneImage topicId={topicId} card={task.sceneBefore} blurred={false} />
          <span className="fc-scene-label">до</span>
        </div>
      </div>

      <p className="session-instruction">{task.question ?? mode?.ui?.instruction ?? "Какой инструмент нужен?"}</p>

      <div className="fc-tool-grid">
        {task.options.map(opt => (
          <ToolOption
            key={opt.conceptId}
            option={opt}
            topicId={topicId}
            selected={selected}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {phase === "feedback" && selected && (
        <div
          className={`session-fb-overlay session-fb-overlay--${selected.isTarget ? "correct" : "incorrect"} session-fb-overlay--ready`}
          aria-hidden="true"
        >
          <span className="session-fb-overlay__icon">{selected.isTarget ? "✓" : "✕"}</span>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────
export default function FunctionCardsRenderer({
  task,
  mode,
  topicId,
  soundEnabled,
  playTopicFile,
  playFeedback,
  onCorrect,
  onIncorrect,
  onMistake,
  onQualityAnswer,
  onAdvance,
  ...rest
}) {
  if (!task) return null;

  const sharedProps = { task, mode, topicId, soundEnabled, playTopicFile, playFeedback, onCorrect, onIncorrect, onMistake, onQualityAnswer };

  switch (task.type) {
    case "fc_intro":
      return <FunctionIntroTask task={task} topicId={topicId} soundEnabled={soundEnabled} playTopicFile={playTopicFile} onAdvance={onAdvance} />;
    case "choose_action":
      return <ChooseActionTask task={task} topicId={topicId} soundEnabled={soundEnabled} playTopicFile={playTopicFile} playFeedback={playFeedback} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "scene_function":
      return <SceneFunctionTask {...sharedProps} mode={mode} />;
    default:
      return <FlashcardsRenderer {...sharedProps} onAdvance={onAdvance} {...rest} />;
  }
}
