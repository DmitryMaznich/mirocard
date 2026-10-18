import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { getTopicTitle } from "@/shared/utils/format";
import Diktor from "@/shared/components/Diktor.jsx";

function getTaskAudioPath(task) {
  if (task?.card?.audio?.ru) return task.card.audio.ru;
  if (task?.type === "find_n") {
    const target = task.options?.find((o) => o.isTarget);
    return target?.card?.audio?.ru ?? null;
  }
  return null;
}

// mode.ui.promptTemplate ("Покажи: {label}") frames the target word on screen;
// the spoken prompt stays the recorded word alone.
function promptText(mode, label) {
  const template = mode?.ui?.promptTemplate;
  return template ? template.replace("{label}", label ?? "") : label;
}

const MOOD_VALENCES = new Set(["positive", "negative", "neutral"]);

function CardImage({ topicId, card, imageFit }) {
  const url = useTopicFile(topicId, card?.image);
  if (!card?.image) return null;
  const valence = card?.semantic?.group1;
  const haloClass = MOOD_VALENCES.has(valence) ? ` card-img-wrap--${valence}` : "";
  const fitClass = imageFit ? ` card-img--${imageFit}` : "";
  if (!url) {
    return (
      <span className={`card-img-wrap${haloClass}`}>
        <div className={`card-img card-img--loading${fitClass}`} />
      </span>
    );
  }
  return (
    <span className={`card-img-wrap${haloClass}`}>
      <img className={`card-img${fitClass}`} src={url} alt="" draggable={false} />
    </span>
  );
}

function SituationScene({ topicId, image }) {
  const url = useTopicFile(topicId, image);
  if (!image) return null;
  if (!url) return <div className="situation-scene situation-scene--loading" />;
  return <img className="situation-scene" src={url} alt="" draggable={false} />;
}

function CardArea({ topicId, card, imageFit }) {
  return (
    <div className="card-area">
      <CardImage topicId={topicId} card={card} imageFit={imageFit} />
    </div>
  );
}

function AudioButton({ topicId, audioPath, playTopicFile, soundEnabled }) {
  if (!audioPath || !soundEnabled) return null;
  return (
    <button
      className="session-audio-icon-button session-audio-icon-button--active question-answer-audio-button"
      onClick={(e) => { e.stopPropagation(); playTopicFile(topicId, audioPath); }}
      aria-label="Повторить"
    >
      🔊
    </button>
  );
}

function SpeechButton({ text, soundEnabled }) {
  const { speak } = useSpeech();
  if (!text || !soundEnabled) return null;
  return (
    <button
      className="session-audio-icon-button session-audio-icon-button--active question-answer-audio-button"
      onClick={(e) => { e.stopPropagation(); speak(text); }}
      aria-label="Повторить"
    >
      🔊
    </button>
  );
}

function InlineSpeechButton({ text, soundEnabled }) {
  const { speak } = useSpeech();
  if (!text || !soundEnabled) return null;
  return (
    <button
      className="session-audio-icon-button session-audio-icon-button--active qa-inline-speech"
      onClick={(event) => { event.stopPropagation(); speak(text); }}
      aria-label="Повторить вопрос"
    >
      🔊
    </button>
  );
}

function InlineAudioButton({ topicId, audioPath, playTopicFile, soundEnabled }) {
  if (!audioPath || !soundEnabled) return null;
  return (
    <button
      className="session-audio-icon-button session-audio-icon-button--active qa-inline-speech"
      onClick={(event) => { event.stopPropagation(); playTopicFile(topicId, audioPath); }}
      aria-label="Повторить вопрос"
    >
      🔊
    </button>
  );
}

function IntroTask({ task, mode, topicId, soundEnabled, playTopicFile, onAdvance }) {
  const audioPath = getTaskAudioPath(task);
  const { speak } = useSpeech();
  const speechText = task?.card?.speech ?? null;

  useEffect(() => {
    if (audioPath) playTopicFile(topicId, audioPath);
    else if (speechText && soundEnabled) speak(speechText);
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <button className="session-full-tap" onClick={onAdvance}>
      <CardArea topicId={topicId} card={task.card} />
      <div className="session-label">
        {mode?.answerPrefix && <span className="session-label__prefix">{mode.answerPrefix} </span>}
        {task.label}
      </div>
      <div className="session-hint">Нажми, чтобы продолжить</div>
      {audioPath
        ? <AudioButton topicId={topicId} audioPath={audioPath} playTopicFile={playTopicFile} soundEnabled={soundEnabled} />
        : <SpeechButton text={speechText} soundEnabled={soundEnabled} />}
    </button>
  );
}

function SituationIntroSticker({ topicId, image }) {
  const url = useTopicFile(topicId, image);
  if (!url) return null;
  return (
    <div className="situation-intro__sticker">
      <img src={url} alt="" draggable={false} />
    </div>
  );
}

function SituationIntroTask({ task, topicId, onAdvance }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { setRevealed(false); }, [task]);
  const hasScene = Boolean(task.sceneImage);

  function handleTap() {
    if (!revealed) { setRevealed(true); return; }
    onAdvance();
  }

  return (
    <button className="session-full-tap situation-intro" onClick={handleTap}>
      <div className="session-instruction">{task.situationText}</div>
      {hasScene && !revealed ? (
        <>
          <SituationScene topicId={topicId} image={task.sceneImage} />
          <div className="session-instruction situation-intro__question">Что чувствует?</div>
        </>
      ) : (
        <>
          {hasScene && revealed && (
            <>
              <SituationIntroSticker topicId={topicId} image={task.sceneImage} />
              <div className="situation-intro__link" />
            </>
          )}
          <CardArea topicId={topicId} card={task.card} />
          {!hasScene && <div className="session-instruction situation-intro__question">Что чувствует?</div>}
          <div className={`situation-intro__reveal${revealed ? " situation-intro__reveal--shown" : ""}`}>
            <div className="situation-intro__label">{task.label}</div>
          </div>
        </>
      )}
      {!revealed && <div className="session-hint">{hasScene ? "Нажми, чтобы увидеть ответ" : "Нажми, чтобы узнать ответ"}</div>}
    </button>
  );
}

function QuestionAnswerTask({ task, mode, sessionParams, topicId, soundEnabled, playTopicFile, onQualityAnswer, onCardShown, onQuality }) {
  const audioPath       = getTaskAudioPath(task);
  const prefixAudioPath = mode?.answerPrefixAudio ?? null;
  const useKeyboard     = useAppStore((s) => s.settings.physicalKeyboard ?? false);
  const { speak }       = useSpeech();
  const [revealed,      setRevealed] = useState(false);
  const question = task.question ?? getTopicTitle(mode.ui.instruction);

  useEffect(() => {
    setRevealed(false);
    onCardShown?.(task.card?.id, task.conceptId);
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (task.promptSpeech && soundEnabled) {
      // Individual personal questions have no deck audio.  The replay control
      // sits directly after the question, matching receptive "Где ...?" tasks.
      speak(task.promptSpeech);
    }
  }, [task, soundEnabled, speak]);

  function handleQuality(value) {
    if (revealed) return;
    setRevealed(true);
    onQuality?.(value, task.card?.id, task.conceptId);

    const hasPrefix = Boolean(prefixAudioPath && soundEnabled);
    const hasMain   = Boolean(audioPath && soundEnabled);
    const PREFIX_GAP = 480; // ms to wait after prefix before main audio

    if (hasPrefix) {
      playTopicFile(topicId, prefixAudioPath);
      if (hasMain) setTimeout(() => playTopicFile(topicId, audioPath), PREFIX_GAP);
    } else if (hasMain) {
      playTopicFile(topicId, audioPath);
    }

    const delay = hasPrefix ? PREFIX_GAP + 1400 : (hasMain ? 1400 : 700);
    setTimeout(() => {
      onQualityAnswer(value, task.conceptId, task.card?.id);
    }, delay);
  }

  useEffect(() => {
    if (!useKeyboard) return;
    function onKey(e) {
      const quality = RATING_KEY_MAP[e.key];
      if (quality) handleQuality(quality);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [useKeyboard, revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="session-body qa-body">
      <CardArea topicId={topicId} card={task.card} />
      <div className="qa-right-panel">
        <div className="qa-question-area">
          <div className="session-instruction">{question}</div>
          <InlineSpeechButton text={task.promptSpeech} soundEnabled={soundEnabled} />
        </div>
        <div className={`qa-reveal${revealed ? " qa-reveal--shown" : ""}`}>
          {mode?.answerPrefix ? `${mode.answerPrefix} ${task.label}` : task.label}
        </div>
        <RatingButtons disabled={revealed} onRate={handleQuality} labels={{ fail: "Не ответил" }} />
      </div>
    </div>
  );
}

// Three outcomes the adult can tell apart at a glance, labelled on the
// buttons themselves (no numbered legend) — the one rating row of every
// adult-rated flashcard mode («Что …?», «Сделай»). A fourth "Правильно" next
// to "Легко" only made the adult split hairs mid-lesson.
const RATING_BUTTONS = [
  { value: "fail",     label: "Не понимает",  mod: "fail"     },
  { value: "prompted", label: "С подсказкой", mod: "prompted" },
  { value: "easy",     label: "Легко",        mod: "easy"     },
];

const RATING_KEY_MAP = { "1": "fail", "2": "prompted", "3": "easy" };

// `labels` renames a button for a mode whose task is not about understanding
// («Что делает?»: the child names the action — «Не ответил», not «Не понимает»).
function RatingButtons({ disabled, onRate, labels = {} }) {
  return (
    <div className="rating-row">
      {RATING_BUTTONS.map((btn) => (
        <button key={btn.value} type="button" className={`rating-btn rating-btn--${btn.mod}`} disabled={disabled} onClick={() => onRate(btn.value)}>
          {labels[btn.value] ?? btn.label}
        </button>
      ))}
    </div>
  );
}

// «Сделай»: does the child understand the spoken command? Only the voice
// comes first ("Прыгай!") - a picture on screen would let the child copy the
// pose without listening. If nothing happens the adult opens the picture
// (a prompt) or shows the action; that is «С подсказкой». No word follows the
// rating: a third-person "прыгает" said about the child who just jumped is
// wrong grammar, and a second form of the verb is only noise here.
function ActOutTask({ task, topicId, soundEnabled, playTopicFile, isTopicAudioPlaying, onQualityAnswer, onCardShown, onQuality }) {
  const { speak } = useSpeech();
  const [rated, setRated] = useState(false);
  const [hint, setHint] = useState(false);

  function sayCommand() {
    if (!soundEnabled) return;
    if (task.imperativeAudio?.ru) playTopicFile(topicId, task.imperativeAudio.ru);
    else speak(task.imperative);
  }

  // SessionScreen remounts the renderer per task, so rated/hint start fresh.
  useEffect(() => {
    onCardShown?.(task.card?.id, task.conceptId);
    sayCommand();
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleQuality(value) {
    if (rated) return;
    setRated(true);
    setHint(true);
    onQuality?.(value, task.card?.id, task.conceptId);
    setTimeout(() => onQualityAnswer(value, task.conceptId, task.card?.id), 900);
  }

  return (
    <div className="session-body qa-body">
      {hint
        ? <CardArea topicId={topicId} card={task.card} />
        : <div className="card-area"><Diktor playing={Boolean(isTopicAudioPlaying)} onClick={sayCommand} label="Повторить команду" /></div>}
      <div className="qa-right-panel">
        <div className="qa-question-area">
          <div className="session-instruction">{task.imperative}</div>
        </div>
        {!hint && (
          <button type="button" className="act-out-hint" onClick={() => setHint(true)}>Подсказка: картинка</button>
        )}
        <RatingButtons disabled={rated} onRate={handleQuality} />
      </div>
    </div>
  );
}

function EmotionControlTask({ task, topicId, onCorrect, onIncorrect, onCardShown, onTap }) {
  const [result, setResult] = useState(null); // null | { conceptId, outcome: "correct" | "incorrect" }

  useEffect(() => {
    setResult(null);
    onCardShown?.(task.card?.id, task.conceptId);
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOption(option) {
    if (result) return;
    onTap?.(option.conceptId, option.isTarget);
    const outcome = option.isTarget ? "correct" : "incorrect";
    setResult({ conceptId: option.conceptId, outcome });
    setTimeout(() => {
      if (option.isTarget) onCorrect(task.conceptId, task.card.id);
      else                 onIncorrect(task.conceptId, task.card.id);
    }, 1500);
  }

  return (
    <div className="session-body session-body--emotion-control">
      <div className="emotion-control__prompt">
        <div className="session-instruction">Что чувствует?</div>
        <CardArea topicId={topicId} card={task.card} />
        <div className="emotion-control__hint">Назови эмоцию и выбери ответ.</div>
      </div>
      <div className="emotion-control__choices">
        {task.options.map((option) => {
          const isTappedWrong = result?.conceptId === option.conceptId && result.outcome === "incorrect";
          const revealCorrect  = Boolean(result) && option.isTarget;
          const stateClass = revealCorrect ? " emotion-control__choice--correct" : isTappedWrong ? " emotion-control__choice--wrong" : "";
          return (
            <button
              key={option.conceptId}
              className={`emotion-control__choice${stateClass}`}
              disabled={!!result}
              onClick={() => handleOption(option)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YesNoTask({ task, mode, topicId, onCorrect, onIncorrect, onCardShown, onTap }) {
  const [result, setResult] = useState(null); // null | "correct" | "incorrect"

  useEffect(() => {
    setResult(null);
    onCardShown?.(task.card?.id, task.conceptId);
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnswer(tappedYes) {
    if (result !== null) return;
    const correct = tappedYes === task.isLabelCorrect;
    const outcome = correct ? "correct" : "incorrect";
    setResult(outcome);
    onTap?.(tappedYes ? "yes" : "no", correct);
    setTimeout(() => {
      if (correct) onCorrect(task.conceptId, task.card.id);
      else         onIncorrect(task.conceptId, task.card.id);
    }, 1500);
  }

  const displayLower  = task.displayLabel?.toLowerCase() ?? "";
  const correctLower  = task.correctLabel?.toLowerCase()  ?? displayLower;
  const prefix        = mode?.answerPrefix ?? "Это";
  const question      = `${prefix} ${displayLower}?`;
  const feedbackText  = result === "correct"
    ? `Правильно! ${prefix} ${correctLower}!`
    : result === "incorrect"
      ? `Нет! ${prefix} ${correctLower}!`
      : null;

  return (
    <div className="session-body session-body--yes-no">
      <CardArea topicId={topicId} card={task.card} />
      <div className="yn-right-panel">
        <div className={`session-label yn-label${result ? ` yn-label--${result}` : ""}`}>
          {feedbackText ?? question}
        </div>
        {!result && (
          <div className="yes-no-row">
            <button className="yes-no-btn yes-no-btn--no"  onClick={() => handleAnswer(false)}>НЕТ</button>
            <button className="yes-no-btn yes-no-btn--yes" onClick={() => handleAnswer(true)}>ДА</button>
          </div>
        )}
      </div>
    </div>
  );
}

function FindNOption({ option, topicId, state, disabled, onClick }) {
  const url = useTopicFile(topicId, option.card?.image);
  return (
    <button className={`find-n-option${state ? ` find-n-option--${state}` : ""}`} disabled={disabled} onClick={() => onClick(option)}>
      {url
        ? <img className="find-n-option__img" src={url} alt="" draggable={false} />
        : <div className="find-n-option__img find-n-option__img--loading" />
      }
    </button>
  );
}

// sessionParams.errorless: a miss is recorded, then the wrong pictures fade,
// the right one pulses and the word plays again; only the right picture stays
// tappable, so the child ends every trial on the correct answer instead of
// guessing again (same as my_people «Покажи»). Finishing after a miss - or on
// a single picture, where there is nothing to choose - counts as assisted.
function FindNTask({ task, mode, sessionParams, topicId, soundEnabled, playTopicFile, onCorrect, onIncorrect, onStreakReset, onCardShown, onTap }) {
  const { speak } = useSpeech();
  const audioPath = task.promptAudio?.ru ?? null;
  const errorless = sessionParams?.errorless === true;
  const [missed, setMissed] = useState(false);
  const [done, setDone] = useState(false);

  function playPrompt() {
    if (!soundEnabled) return;
    if (audioPath) playTopicFile(topicId, audioPath);
    else if (task.promptSpeech) speak(task.promptSpeech);
  }

  // SessionScreen remounts the renderer per task, so missed/done start fresh.
  useEffect(() => {
    onCardShown?.(null, task.targetConceptId);
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    playPrompt();
  }, [task, soundEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOption(option) {
    if (done) return;
    onTap?.(option.card.id, option.isTarget);
    if (!errorless) {
      if (option.isTarget) onCorrect(task.targetConceptId, option.card.id);
      else                 onIncorrect(task.targetConceptId, option.card.id);
      return;
    }
    if (option.isTarget) {
      setDone(true);
      const assisted = missed || task.options.length === 1;
      onCorrect(task.targetConceptId, option.card.id, assisted ? { assisted: true } : undefined);
      return;
    }
    if (missed) return;
    setMissed(true);
    onStreakReset?.(task.targetConceptId, option.card.id);
    setTimeout(playPrompt, 500);
  }

  function optionState(option) {
    if (!errorless || !missed) return "";
    return option.isTarget ? (done ? "correct" : "hint") : "faded";
  }

  const cols = 2;
  const rows = Math.ceil(task.options.length / cols);
  const inlinePrompt = task.inlinePromptAudio && !task.sceneImage;
  const promptControl = audioPath
    ? <InlineAudioButton topicId={topicId} audioPath={audioPath} playTopicFile={playTopicFile} soundEnabled={soundEnabled} />
    : <InlineSpeechButton text={task.promptSpeech} soundEnabled={soundEnabled} />;

  return (
    <div className={`session-body session-body--find-n${task.sceneImage ? " session-body--situation" : ""}`} style={{ "--rows": rows }}>
      {task.sceneImage && (
        <div className="situation-emotion__prompt">
          <div className="session-instruction">{task.targetLabel}</div>
          <SituationScene topicId={topicId} image={task.sceneImage} />
          {mode?.ui?.instruction && (
            <div className="situation-emotion__question">{mode.ui.instruction}</div>
          )}
        </div>
      )}
      {!task.sceneImage && (
        <div className={`session-instruction${inlinePrompt ? " find-n-question" : ""}`}>
          <span>{promptText(mode, task.targetLabel)}</span>
          {inlinePrompt && promptControl}
        </div>
      )}
      <div className={task.sceneImage ? "situation-emotion__choices" : undefined}>
        <div className="find-n-grid" style={{ "--cols": cols }}>
          <div className="find-n-inner">
            {task.options.map((option) => (
              <FindNOption
                key={option.card.id}
                option={option}
                topicId={topicId}
                state={optionState(option)}
                disabled={errorless && missed && !option.isTarget}
                onClick={handleOption}
              />
            ))}
          </div>
        </div>
      </div>
      {!inlinePrompt && (audioPath
        ? <AudioButton topicId={topicId} audioPath={audioPath} playTopicFile={playTopicFile} soundEnabled={soundEnabled} />
        : <SpeechButton text={task.promptSpeech} soundEnabled={soundEnabled} />)}
    </div>
  );
}

function SituationOption({ option, topicId, onClick }) {
  const url = useTopicFile(topicId, option.sceneImage);
  return (
    <button className="find-n-option emotion-situation__option" onClick={() => onClick(option)}>
      {url
        ? <img className="find-n-option__img" src={url} alt="" draggable={false} />
        : <div className="find-n-option__img find-n-option__img--loading" />
      }
    </button>
  );
}

function EmotionSituationTask({ task, topicId, onCorrect, onIncorrect, onCardShown, onTap }) {
  useEffect(() => {
    onCardShown?.(task.card?.id, task.conceptId);
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOption(option) {
    onTap?.(option.id, option.isTarget);
    if (option.isTarget) onCorrect(task.conceptId, task.card.id);
    else                 onIncorrect(task.conceptId, task.card.id);
  }

  const cols = 2;
  const rows = Math.ceil(task.options.length / cols);

  return (
    <div className="session-body session-body--find-n session-body--emotion-situation" style={{ "--rows": rows }}>
      <div className="emotion-situation__prompt">
        <div className="session-instruction">Когда так бывает?</div>
        <CardArea topicId={topicId} card={task.card} />
      </div>
      <div className="emotion-situation__choices">
        <div className="find-n-grid" style={{ "--cols": cols }}>
          <div className="find-n-inner">
            {task.options.map((option) => (
              <SituationOption key={option.id} option={option} topicId={topicId} onClick={handleOption} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChooseWordTask({ task, topicId, onCorrect, onIncorrect, onCardShown, onTap }) {
  const [result, setResult] = useState(null); // null | { optionId, outcome: "correct" | "incorrect" }

  useEffect(() => {
    setResult(null);
    onCardShown?.(task.card?.id, task.conceptId);
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOption(option) {
    if (result) return;
    onTap?.(option.conceptId, option.isTarget);
    const outcome = option.isTarget ? "correct" : "incorrect";
    setResult({ optionId: option.conceptId, outcome });
    setTimeout(() => {
      if (option.isTarget) onCorrect(task.conceptId, task.card.id);
      else                 onIncorrect(task.conceptId, task.card.id);
    }, 1500);
  }

  return (
    <div className="session-body session-body--choose-word">
      <CardArea topicId={topicId} card={task.card} />
      <div className="choose-word-options">
        {task.options.map((option) => {
          const isTappedWrong = result?.optionId === option.conceptId && result.outcome === "incorrect";
          const revealCorrect  = Boolean(result) && option.isTarget;
          const stateClass = revealCorrect ? " choose-word-btn--correct" : isTappedWrong ? " choose-word-btn--wrong" : "";
          return (
            <button
              key={option.conceptId}
              className={`choose-word-btn${stateClass}`}
              disabled={!!result}
              onClick={() => handleOption(option)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SortByAttributeTask({ task, mode, topicId, soundEnabled, playTopicFile, onCorrect, onIncorrect, onCardShown, onTap }) {
  const { speak } = useSpeech();
  const [result, setResult] = useState(null);
  // people_names is this mode's only user, and only ever sorts by age now
  // (see engine.js's generateSortByAttributeTasks) - the "category" grouping
  // was cut as redundant with find_n, which already tests that discrimination.
  const instruction = "Ребёнок или взрослый?";
  const audioPath = mode?.ui?.instructionAudio?.age?.ru ?? null;

  useEffect(() => {
    setResult(null);
    onCardShown?.(task.card?.id, task.conceptId);
    if (!soundEnabled) return;
    if (audioPath) playTopicFile(topicId, audioPath);
    else speak(instruction);
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleGroup(group) {
    if (result) return;
    const correct = group.value === task.targetValue;
    setResult({ value: group.value, correct });
    onTap?.(group.value, correct);
    setTimeout(() => {
      if (correct) onCorrect(task.conceptId, task.card.id);
      else         onIncorrect(task.conceptId, task.card.id);
    }, 1200);
  }

  return (
    <div className={`session-body session-body--sort-attribute session-body--sort-attribute--${task.groups.length}`}>
      <div className="session-instruction">{instruction}</div>
      <CardArea topicId={topicId} card={task.card} imageFit={task.groups.length === 4 ? "contain" : undefined} />
      <div className={`sort-attribute-options sort-attribute-options--${task.groups.length}`}>
        {task.groups.map((group) => {
          const isChosen = result?.value === group.value;
          const stateClass = isChosen ? (result.correct ? " sort-attribute-btn--correct" : " sort-attribute-btn--wrong") : "";
          return (
            <button
              key={group.value}
              className={`sort-attribute-btn${stateClass}`}
              disabled={Boolean(result)}
              onClick={() => handleGroup(group)}
            >
              {group.label}
            </button>
          );
        })}
      </div>
      {audioPath
        ? <AudioButton topicId={topicId} audioPath={audioPath} playTopicFile={playTopicFile} soundEnabled={soundEnabled} />
        : <SpeechButton text={instruction} soundEnabled={soundEnabled} />}
    </div>
  );
}

function ChooseAllOption({ card, topicId, mark, onClick, disabled, imageFit }) {
  const url = useTopicFile(topicId, card?.image);
  const fitClass = imageFit ? ` choose-all-option__img--${imageFit}` : "";
  return (
    <button
      className={`choose-all-option${mark ? ` choose-all-option--${mark}` : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {url
        ? <img className={`choose-all-option__img${fitClass}`} src={url} alt="" draggable={false} />
        : <div className={`choose-all-option__img choose-all-option__img--loading${fitClass}`} />
      }
      {mark && (
        <span className={`choose-all-badge choose-all-badge--${mark}`}>
          {mark === "correct" ? "✓" : "✕"}
        </span>
      )}
    </button>
  );
}

function ChooseAllTask({ task, mode, topicId, soundEnabled, playTopicFile, onCorrect, onIncorrect, imageFit }) {
  const [marks,    setMarks]    = useState({});
  const [hadWrong, setHadWrong] = useState(false);
  const [done,     setDone]     = useState(false);
  // mode.ui.autoplayPrompt: say the target word when the grid appears (verbs_v2,
  // whose children mostly can't read the word above the grid).
  const audioPath = mode?.ui?.autoplayPrompt ? (task.promptAudio?.ru ?? null) : null;

  useEffect(() => {
    if (audioPath && soundEnabled) playTopicFile(topicId, audioPath);
  }, [task, soundEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const targetIds = new Set(task.targetCardIds);

  function handleTap(card) {
    if (done || marks[card.id]) return;
    const isTarget   = targetIds.has(card.id);
    const newMarks   = { ...marks, [card.id]: isTarget ? "correct" : "wrong" };
    const newHadWrong = hadWrong || !isTarget;
    setMarks(newMarks);
    if (!isTarget) setHadWrong(true);
    const allFound = task.targetCardIds.every((id) => newMarks[id] === "correct");
    if (allFound) {
      setDone(true);
      if (newHadWrong) onIncorrect(task.conceptId, null);
      else             onCorrect(task.conceptId, null);
    }
  }

  const cols = task.allCards.length === 9 ? 3 : 2;
  const rows = Math.ceil(task.allCards.length / cols);
  const foundCount = task.targetCardIds.filter((id) => marks[id] === "correct").length;

  return (
    <div className="session-body">
      <div className="choose-all-instruction">
        {mode?.ui?.promptTemplate
          ? <strong>{promptText(mode, task.targetLabel)}</strong>
          : <>Найди все: <strong>{task.targetLabel}</strong></>}
        <InlineAudioButton topicId={topicId} audioPath={audioPath} playTopicFile={playTopicFile} soundEnabled={soundEnabled} />
      </div>
      <div className="choose-all-progress">Найдено {foundCount} из {task.targetCardIds.length}</div>
      <div className="choose-all-grid" style={{ "--cols": cols, "--rows": rows }}>
        <div className="choose-all-inner">
        {task.allCards.map((card) => (
          <ChooseAllOption
            key={card.id}
            card={card}
            topicId={topicId}
            mark={marks[card.id]}
            onClick={() => handleTap(card)}
            disabled={done || !!marks[card.id]}
            imageFit={imageFit}
          />
        ))}
        </div>
      </div>
    </div>
  );
}

const TASK_RENDERERS = {
  intro:                  IntroTask,
  question_answer:        QuestionAnswerTask,
  act_out:                ActOutTask,
  yes_no:                 YesNoTask,
  find_n:                 FindNTask,
  situation_emotion:      FindNTask,
  situation_intro:        SituationIntroTask,
  emotion_situation:      EmotionSituationTask,
  emotion_control:        EmotionControlTask,
  choose_word_by_picture: ChooseWordTask,
  choose_all:             ChooseAllTask,
  generalisation_probe:   FindNTask,
  offphoto_find_n:        FindNTask,
  sort_by_attribute:      SortByAttributeTask,
};

export default function FlashcardsRenderer({ task, mode, sessionParams, topicId, soundEnabled, playTopicFile, isTopicAudioPlaying, onCorrect, onIncorrect, onStreakReset, onAdvance, onQualityAnswer, onCardShown, onTap, onQuality }) {
  const TaskRenderer = TASK_RENDERERS[task?.type];
  if (!TaskRenderer) return <div className="session-body">Неизвестный тип задания: {task?.type}</div>;
  return (
    <TaskRenderer
      task={task}
      mode={mode}
      sessionParams={sessionParams}
      topicId={topicId}
      soundEnabled={soundEnabled}
      playTopicFile={playTopicFile}
      isTopicAudioPlaying={isTopicAudioPlaying}
      onCorrect={onCorrect}
      onIncorrect={onIncorrect}
      onStreakReset={onStreakReset}
      onAdvance={onAdvance}
      onQualityAnswer={onQualityAnswer}
      onCardShown={onCardShown}
      onTap={onTap}
      onQuality={onQuality}
      imageFit={mode?.ui?.imageFit}
    />
  );
}
