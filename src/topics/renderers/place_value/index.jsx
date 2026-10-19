import { useEffect, useRef, useState } from "react";
import { ALL_AUDIO_URLS, isAudioPreloaded, preloadNumberAudio } from "./numberAudio.js";
import BuildNumberTask from "./BuildNumberTask.jsx";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";
import ExchangeTenTask from "./ExchangeTenTask.jsx";
import GroupTenTask from "./GroupTenTask.jsx";
import PlacePartsTask from "./PlacePartsTask.jsx";
import NumberNamesTask from "./NumberNamesTask.jsx";
import CountTensTask from "./CountTensTask.jsx";
import { checkTaskText } from "./engine.js";

const TASKS = {
  group_ten: GroupTenTask,
  build_number: BuildNumberTask,
  identify_number: IdentifyNumberTask,
  exchange_ten: ExchangeTenTask,
  place_parts: PlacePartsTask,
  number_names: NumberNamesTask,
  count_tens: CountTensTask,
};

// How long a wrong answer stays red in a check before the next task.
export const CHECK_MISTAKE_MS = 1000;

// A wrong answer here is one step inside a multi-step task (questions already
// answered, a model half built), so with strict stars it goes through
// onStreakReset: the mistake and the lost streak are recorded, but taskRetry
// isn't bumped and SessionScreen doesn't remount the task and wipe that work.
// Tasks that speak: they wait until every voice clip is loaded (AudioGate).
const VOICED = new Set(["number_names", "count_tens"]);

export default function PlaceValueRenderer(props) {
  const { task } = props;
  const [ready, setReady] = useState(isAudioPreloaded);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  // Any task of the topic starts loading the voice in the background, so a
  // check reaches its first «Названия чисел» task with the clips already here.
  const start = () => preloadNumberAudio((loaded) => setProgress(loaded)).then(() => setReady(true), () => setFailed(true));
  const retry = () => { setFailed(false); start(); };
  useEffect(() => { if (!isAudioPreloaded()) start(); }, []);
  if (VOICED.has(task?.type) && !ready) return <AudioGate loaded={progress} failed={failed} onRetry={retry} />;
  return <PlaceValueTask {...props} />;
}

// No lesson without the voice: until all clips are here the task waits, with
// the loading counted; without a connection — say so and offer to try again.
function AudioGate({ loaded, failed, onRetry }) {
  return <div className="pv-screen pv-audio-gate" role="status">
    {failed ? <>
      <div className="pv-audio-gate__title">Голос не загрузился</div>
      <div className="pv-audio-gate__text">Проверьте интернет. Без голоса задание не начнётся.</div>
      <button type="button" className="pv-audio-gate__retry" onClick={onRetry}>Повторить</button>
    </> : <>
      <div className="pv-audio-gate__title">Загружаю голос…</div>
      <div className="pv-audio-gate__bar"><i style={{ width: `${Math.round((loaded / ALL_AUDIO_URLS.length) * 100)}%` }} /></div>
      <div className="pv-audio-gate__text">{loaded} из {ALL_AUDIO_URLS.length}</div>
    </>}
  </div>;
}

function PlaceValueTask({ task, sessionParams, onCorrect, onIncorrect, onStreakReset, onFlashIncorrect }) {
  const Task = TASKS[task?.type];
  if (!Task) return <div className="pv-screen" style={{ color: "#666", fontSize: 18 }}>Нет задания</div>;
  if (task.check) return <CheckTask key={task.cardId} Task={Task} task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} onFlashIncorrect={onFlashIncorrect} />;
  return (
    <Task
      key={`${task.cardId}-${task.number}`}
      task={task}
      onCorrect={onCorrect}
      onMistake={sessionParams?.strictStars ? (conceptId, cardId) => onStreakReset(conceptId, cardId) : undefined}
      onFlashIncorrect={onFlashIncorrect}
    />
  );
}

// A task of a check («Контрольная работа: до 100»): the mode's own screen without hints;
// the first mistake leaves the answer red for a moment (no explanation, no
// right answer shown), then the next task — taps wait meanwhile. What the child
// answered goes with it, for the result's list of mistakes.
function CheckTask({ Task, task, onCorrect, onIncorrect, onFlashIncorrect }) {
  const [frozen, setFrozen] = useState(false);
  const done = useRef(false);
  function mistake(conceptId, cardId, detail) {
    if (done.current) return;
    done.current = true;
    setFrozen(true);
    const answer = detail && { skill: task.checkSkill, view: task.checkView, task: checkTaskText(task), field: detail.field ?? null, given: detail.given, expected: detail.expected };
    setTimeout(() => onIncorrect?.(conceptId, cardId, answer), CHECK_MISTAKE_MS);
  }
  return (
    <div className="pv-check">
      <Task task={task} onCorrect={(...args) => { if (!done.current) { done.current = true; onCorrect(...args); } }} onMistake={mistake} onFlashIncorrect={onFlashIncorrect} />
      {frozen && <div className="pv-check-freeze" aria-hidden="true" />}
    </div>
  );
}
