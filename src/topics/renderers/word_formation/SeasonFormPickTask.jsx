import { useLayoutEffect, useMemo, useRef, useState } from "react";
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

  const anchorRef = useRef(null);

  const bgUrl   = useTopicFile(topicId, card.backgroundImage ?? "");
  const itemUrl = useTopicFile(topicId, item.image ?? "");

  // Keep spacer = half of card height so card sits exactly on the boundary
  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const update = () => {
      const root = el.closest(".wf-sfp");
      if (root) root.style.setProperty("--sfp-card-half", Math.ceil(el.offsetHeight / 2) + "px");
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { stem, ending: correctEnding, noun } = splitAdj(item.adjPhrase);
  const seasonName = (card.contextPhrase ?? "").trim().split(/\s+/).at(-1);
  const qEnd       = QUESTION_END[correctEnding] ?? "ой";

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
      {/* Season photo — card anchor sits at bottom edge, overflows downward by 50% */}
      <div className="wf-sfp__season-zone">
        <div className="wf-sfp__season-art">
          {bgUrl
            ? <img className="wf-sfp__season-bg" src={bgUrl} alt="" draggable={false} />
            : <div className="wf-sfp__season-bg--empty" />
          }
        </div>
        <div className="wf-sfp__season-pill-wrap">
          <span className="wf-sfp__season-pill">
            {"Время года — "}<strong>{seasonName}</strong>
          </span>
        </div>
        <div className="wf-sfp__card-anchor" ref={anchorRef}>
          <div className="wf-sfp__item-card">
            {itemUrl && (
              <img className="wf-sfp__item-img" src={itemUrl} alt={noun} draggable={false} />
            )}
            <div className="wf-sfp__item-label">
              <div className={`wf-sfp__label-wrap${answered ? " wf-sfp__label-wrap--answered" : ""}`}>
                <div className="wf-sfp__label wf-sfp__label--q">
                  {noun} как<span className="wf-sfp__q-end">{qEnd}</span>?
                </div>
                <div className="wf-sfp__label wf-sfp__label--a">
                  <span><span className="wf-sfp__adj-stem">{stem}</span><span className="wf-sfp__adj-end">{correctEnding}</span></span>
                  <span>{noun}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer equal to bottom half of card so options start below it */}
      <div className="wf-sfp__card-spacer" />

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
