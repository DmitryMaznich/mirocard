import { useMemo } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { buildSeasonFormOptions } from "./exerciseModel";
import { ListenButton } from "./WordSpeech";
import SoupMeaning from "./SoupMeaning";
import { useWordAnswer } from "./useWordAnswer";

const ADJ_ENDINGS = ["ый", "ий", "ой", "ая", "яя", "ое", "ее", "ые", "ие"];

const QUESTION_END = {
  "ий": "ой", "ый": "ой", "ой": "ой",
  "ая": "ая", "яя": "ая",
  "ое": "ое", "ее": "ое",
  "ые": "ие", "ие": "ие",
};

function splitAdj(adjPhrase) {
  const [adj, ...rest] = (adjPhrase ?? "").trim().split(" ");
  const noun = rest.join(" ");
  for (const end of ADJ_ENDINGS) {
    if (adj.endsWith(end)) {
      return { stem: adj.slice(0, -end.length), ending: end, noun };
    }
  }
  return { stem: adj, ending: "", noun };
}

export default function SeasonFormPickTask({ task, topicId, onCorrect, onIncorrect }) {
  const { card, item } = task;
  const food = card.category === "soup";
  const checking = task.params?.activityStage === "check";
  const questionHint = !checking && task.params?.questionHint !== false;
  const { answer, select } = useWordAnswer(onCorrect, onIncorrect, card.conceptId ?? card.id, `${card.id}:${item.id}`);
  const pickedIdx = answer?.index;
  const status = answer?.status ?? "idle";
  const showImage = task.params?.showImage !== false;

  const bgUrl   = useTopicFile(topicId, card.backgroundImage ?? "");
  const itemUrl = useTopicFile(topicId, item.image ?? "");

  const { stem, ending: correctEnding, noun } = splitAdj(item.adjPhrase);
  const seasonName = (card.contextPhrase ?? "").trim().split(/\s+/).at(-1);
  const qEnd       = QUESTION_END[correctEnding] ?? "ой";

  const options = useMemo(
    () => task.options ?? buildSeasonFormOptions(item.adjPhrase, task.params?.optionCount),
    [task.options, item.adjPhrase, task.params?.optionCount],
  );

  function btnClass(opt, idx) {
    if (status === "correct" && opt.isTarget)    return "wf-sfp__btn--correct";
    if (status === "wrong" && idx === pickedIdx)  return "wf-sfp__btn--wrong";
    if (status === "correct" && !opt.isTarget)   return "wf-sfp__btn--dim";
    return "";
  }

  const answered = status === "correct";

  return (
    <div className={`wf-sfp${checking ? " wf-sfp--check" : ""}${food ? " wf-sfp--food" : showImage && (bgUrl || itemUrl) ? "" : " wf-sfp--text"}`}>
      {/* Season context and example card */}
      <div className="wf-sfp__season-zone">
        {!food && showImage && <div className="wf-sfp__season-art">
          {bgUrl
            ? <img className="wf-sfp__season-bg" src={bgUrl} alt="" draggable={false} />
            : <div className="wf-sfp__season-bg--empty" />
          }
        </div>}
        {food && showImage && <SoupMeaning card={card} item={item} topicId={topicId} />}
        <div className="wf-sfp__season-pill-wrap">
          <span className="wf-sfp__season-pill">
            {food ? item.sourcePhrase : <>Время года — <strong>{seasonName}</strong></>}
          </span>
          <ListenButton text={food ? `${item.sourcePhrase}. ${noun}${questionHint ? " как" + qEnd + "?" : ""}` : `${card.contextPhrase}. ${noun}${questionHint ? " как" + qEnd + "?" : ""}`} label="Послушать условие" />
        </div>
        <div className="wf-sfp__card-anchor">
          <div className="wf-sfp__item-card">
            {showImage && itemUrl && (
              <img className="wf-sfp__item-img" src={itemUrl} alt={noun} draggable={false} />
            )}
            <div className="wf-sfp__item-label">
              <div className={`wf-sfp__label-wrap${answered ? " wf-sfp__label-wrap--answered" : ""}`}>
                <div className="wf-sfp__label wf-sfp__label--q" aria-hidden={answered}>
                  {noun}{questionHint && <> как<span className="wf-sfp__q-end">{qEnd}</span>?</>}
                </div>
                <div className="wf-sfp__label wf-sfp__label--a" aria-hidden={!answered}>
                  <span><span className="wf-sfp__adj-stem">{stem}</span><span className="wf-sfp__adj-end">{correctEnding}</span></span>
                  <span>{noun}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {status === "wrong" && <div className="wf-lesson__feedback" role="status">Посмотрим вместе</div>}
      {/* Choice buttons 2×2 */}
      <div className={`wf-sfp__options${options.length === 2 ? " wf-sfp__options--two" : ""}`}>
        {options.map((opt, idx) => (
          <div className="wf-choice" key={opt.key}>
          <button
            className={`wf-sfp__btn ${btnClass(opt, idx)}`}
            onClick={() => select(opt, idx)}
            disabled={status !== "idle"}
          >
            <span className="wf-sfp__btn-stem">{stem}</span>
            <span className="wf-sfp__btn-end">{opt.ending}</span>
          </button>
          </div>
        ))}
      </div>
    </div>
  );
}
