import { useMemo, useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { shuffle } from "@/shared/utils/shuffle";

const ADJ_ENDINGS = ["ый", "ий", "ой", "ая", "яя", "ое", "ее", "ые", "ие"];

const QUESTION_END = {
  "ий": "ой", "ый": "ой", "ой": "ой",
  "ая": "ая", "яя": "ая",
  "ое": "ое", "ее": "ое",
  "ые": "ие", "ие": "ие",
};

const FORM_SETS = {
  "ий": ["ий", "яя", "ее", "ие"],
  "ый": ["ый", "ая", "ое", "ые"],
  "ой": ["ой", "ая", "ое", "ые"],
  "ая": ["ый", "ая", "ое", "ые"],
  "яя": ["ий", "яя", "ее", "ие"],
  "ое": ["ый", "ая", "ое", "ые"],
  "ее": ["ий", "яя", "ее", "ие"],
  "ые": ["ый", "ая", "ое", "ые"],
  "ие": ["ий", "яя", "ее", "ие"],
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
  const [pickedIdx, setPickedIdx] = useState(null);
  const [status, setStatus]       = useState("idle"); // idle | correct | wrong

  const bgUrl   = useTopicFile(topicId, card.backgroundImage ?? "");
  const itemUrl = useTopicFile(topicId, item.image ?? "");

  const { stem, ending: correctEnding, noun } = splitAdj(item.adjPhrase);
  const seasonName  = (card.contextPhrase ?? "").trim().split(/\s+/).at(-1);
  const questionWord = "как" + (QUESTION_END[correctEnding] ?? "ой") + "?";

  const options = useMemo(
    () => shuffle((FORM_SETS[correctEnding] ?? [correctEnding]).map((end, i) => ({
      key: i,
      ending: end,
      isTarget: end === correctEnding,
    }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.adjPhrase],
  );

  function handlePick(opt, idx) {
    if (status !== "idle") return;
    setPickedIdx(idx);
    if (opt.isTarget) {
      setStatus("correct");
      onCorrect?.();
    } else {
      setStatus("wrong");
      onIncorrect?.();
    }
  }

  function btnClass(opt, idx) {
    if (status === "correct" && opt.isTarget)    return "wf-sfp__btn--correct";
    if (status === "wrong" && idx === pickedIdx)  return "wf-sfp__btn--wrong";
    if (status === "wrong" && opt.isTarget)       return "wf-sfp__btn--reveal";
    if (status !== "idle" && !opt.isTarget)       return "wf-sfp__btn--dim";
    return "";
  }

  const answered = status === "correct";

  return (
    <div className="wf-sfp">
      {/* Season background zone */}
      <div className="wf-sfp__season-zone">
        {bgUrl
          ? <img className="wf-sfp__season-bg" src={bgUrl} alt="" draggable={false} />
          : <div className="wf-sfp__season-bg wf-sfp__season-bg--empty" />
        }
        <div className="wf-sfp__season-pill-wrap">
          <span className="wf-sfp__season-pill">
            {"Время года — "}<strong>{seasonName}</strong>
          </span>
        </div>
      </div>

      {/* Item card (overlaps season zone) */}
      <div className="wf-sfp__item-card">
        {itemUrl && (
          <img className="wf-sfp__item-img" src={itemUrl} alt={noun} draggable={false} />
        )}
        <div className="wf-sfp__item-label">
          <div className={`wf-sfp__label-wrap${answered ? " wf-sfp__label-wrap--answered" : ""}`}>
            <div className="wf-sfp__label wf-sfp__label--q">
              {noun} <span className="wf-sfp__qmark">({questionWord})</span>
            </div>
            <div className="wf-sfp__label wf-sfp__label--a">
              <span className="wf-sfp__adj-stem">{stem}</span>
              <span className="wf-sfp__adj-end">{correctEnding}</span>
              {" "}{noun}
            </div>
          </div>
        </div>
      </div>

      {/* Spacer pushes buttons to the bottom */}
      <div className="wf-sfp__spacer" />

      {/* Choice buttons 2×2 */}
      <div className="wf-sfp__options">
        {options.map((opt, idx) => (
          <button
            key={opt.key}
            className={`wf-sfp__btn ${btnClass(opt, idx)}`}
            onClick={() => handlePick(opt, idx)}
            disabled={status !== "idle"}
          >
            <span className="wf-sfp__btn-stem">{stem}</span>
            <span className="wf-sfp__btn-end">{opt.ending}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
