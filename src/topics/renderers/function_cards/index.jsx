// src/topics/renderers/function_cards/index.jsx
import { useState, useEffect } from "react";
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

const Q_AUDIO_GAP = 1200; // ms between prefix phrase and tool name audio (~1s for phrase to finish)

// ── ChooseActionTask ─────────────────────────────────────────
function ChooseActionTask({ task, topicId, soundEnabled, playTopicFile, onQualityAnswer }) {
  const [selected, setSelected] = useState(null);

  useEffect(() => { setSelected(null); }, [task]);

  useEffect(() => {
    if (soundEnabled) playQuestion();
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  function playQuestion() {
    if (!soundEnabled) return;
    if (task.questionPrefixAudio) {
      playTopicFile(topicId, task.questionPrefixAudio);
      if (task.toolNameAudio) setTimeout(() => playTopicFile(topicId, task.toolNameAudio), Q_AUDIO_GAP);
    } else if (task.toolNameAudio) {
      playTopicFile(topicId, task.toolNameAudio);
    }
  }

  function handleSelect(option) {
    if (selected !== null) return;
    setSelected(option);
    const quality = option.isTarget ? "correct" : "fail";
    setTimeout(() => {
      onQualityAnswer(quality, task.conceptId, task.toolCard?.id ?? null);
    }, 1800);
  }

  const revealed = selected !== null;
  const hasQuestionAudio = Boolean(task.questionPrefixAudio || task.toolNameAudio);

  return (
    <div className="fc-choose-action session-body">
      <div className="fc-ca-photo-wrap">
        {revealed && task.sceneAfterCard
          ? <SceneImage topicId={topicId} card={task.sceneAfterCard} blurred={false} className="fc-ca-revealed" />
          : <ToolImage topicId={topicId} card={task.toolCard} />
        }
      </div>

      <div className="fc-ca-content">
        <div className="fc-ca-question-bar">
          <span>{task.question}</span>
          {hasQuestionAudio && soundEnabled && (
            <button className="fc-ca-audio-btn" onClick={playQuestion} aria-label="Повторить вопрос">🔊</button>
          )}
        </div>

        <div className="fc-action-options">
          {task.options.map(opt => {
            let mod = "";
            if (revealed) {
              if (opt.isTarget) mod = "fc-option--correct";
              else if (selected.conceptId === opt.conceptId) mod = "fc-option--wrong";
            }
            return (
              <button
                key={opt.conceptId}
                className={`fc-option ${mod}`}
                onClick={() => handleSelect(opt)}
                disabled={revealed}
              >
                {opt.actionInf}
              </button>
            );
          })}
        </div>

        {revealed && (
          <div className="fc-ca-answer-text">{task.feedbackText}</div>
        )}
      </div>
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
function SceneFunctionTask({ task, topicId, onQualityAnswer, mode }) {
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setSelected(null);
  }, [task]);

  function handleSelect(option) {
    if (selected !== null) return;
    setSelected(option);
    const quality = option.isTarget ? "correct" : "fail";
    setTimeout(() => {
      onQualityAnswer(quality, task.conceptId, null);
    }, 1500);
  }

  const revealed = selected?.isTarget === true;

  return (
    <div className="fc-scene-function session-body">
      <div className="fc-scenes">
        <div className="fc-scene">
          <SceneImage topicId={topicId} card={task.sceneBefore} blurred={false} />
          <span className="fc-scene-label">до</span>
        </div>
        <span className="fc-arrow" aria-hidden="true">→</span>
        <div className="fc-scene">
          <SceneImage topicId={topicId} card={task.sceneAfter} blurred={!revealed} />
          <span className="fc-scene-label">после</span>
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

      {selected && (
        <p className="fc-feedback session-label">{task.feedbackText}</p>
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
  onQualityAnswer,
  ...rest
}) {
  if (!task) return null;

  const sharedProps = { task, mode, topicId, soundEnabled, playTopicFile, onQualityAnswer };

  switch (task.type) {
    case "choose_action":
      return <ChooseActionTask {...sharedProps} />;
    case "scene_function":
      return <SceneFunctionTask {...sharedProps} mode={mode} />;
    default:
      return <FlashcardsRenderer {...sharedProps} {...rest} />;
  }
}
