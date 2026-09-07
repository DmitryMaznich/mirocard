import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { getVerdict } from "./engine";

const SIGN_CHAR = { less: "<", equal: "=", more: ">" };
const OPTIONS = [
  { value: "less",  label: "Меньше" },
  { value: "equal", label: "Равно"  },
  { value: "more",  label: "Больше" },
];

function Buttons({ style, correct, answered, onAnswer }) {
  const [shake, setShake] = useState(null);

  function handle(value) {
    if (answered) return;
    if (value !== correct) {
      setShake(value);
      setTimeout(() => setShake(null), 400);
    }
    onAnswer(value);
  }

  if (style === "verbal") {
    return (
      <div className="cfn-options">
        {OPTIONS.map((opt) => (
          <button key={opt.value} className="cfn-btn" disabled={answered} onClick={() => handle(opt.value)}>
            <span className="cfn-btn-sign">{SIGN_CHAR[opt.value]}</span>
            <span className="cfn-btn-label">{opt.label}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="croc-put-sign-btns">
      {OPTIONS.map(({ value }) => (
        <button
          key={value}
          className={[
            "croc-put-sign-btn",
            shake === value && "croc-put-sign-btn--shake",
            answered && correct === value && "croc-put-sign-btn--correct",
          ].filter(Boolean).join(" ")}
          disabled={answered}
          onClick={() => handle(value)}
        >
          {SIGN_CHAR[value]}
        </button>
      ))}
    </div>
  );
}

function MultiButtons({ style, disabled, onAnswer }) {
  if (style === "verbal") {
    return (
      <div className="cfn-options">
        {OPTIONS.map((opt) => (
          <button key={opt.value} className="cfn-btn" disabled={disabled} onClick={() => onAnswer(opt.value)}>
            <span className="cfn-btn-sign">{SIGN_CHAR[opt.value]}</span>
            <span className="cfn-btn-label">{opt.label}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="croc-put-sign-btns">
      {OPTIONS.map(({ value }) => (
        <button key={value} className="croc-put-sign-btn" disabled={disabled} onClick={() => onAnswer(value)}>
          {SIGN_CHAR[value]}
        </button>
      ))}
    </div>
  );
}

function SingleMode({ task, onCorrect, onIncorrect, onAdvance }) {
  const [answered, setAnswered] = useState(false);
  const [verdict,  setVerdict]  = useState(null);

  const correct    = task.left > task.right ? "more" : task.left < task.right ? "less" : "equal";
  const showLabels = task.showLabels;
  const style      = task.style ?? "sign";
  const instruction = task.instruction ?? (
    showLabels ? "Сравни первое число со вторым:" : "Поставь правильный знак между числами"
  );

  function handleAnswer(value) {
    if (answered) return;
    setAnswered(true);
    if (value === correct) {
      setVerdict(getVerdict(task));
      onCorrect(task.conceptId, null);
    } else {
      onIncorrect(task.conceptId, null);
    }
  }

  const stage = showLabels ? (
    <div className="cfn-stage">
      <div className="cfn-card cfn-card--first">
        <div className="cfn-label">первое</div>
        <div className="cfn-number">{task.left}</div>
      </div>
      <div className={`cfn-bridge${answered ? " cfn-bridge--shown" : ""}`}>
        {answered ? SIGN_CHAR[correct] : "?"}
      </div>
      <div className="cfn-card cfn-card--second">
        <div className="cfn-label">второе</div>
        <div className="cfn-number">{task.right}</div>
      </div>
    </div>
  ) : (
    <div className="croc-put-sign-numbers">
      <span className="croc-put-sign-num">{task.left}</span>
      <span className="croc-put-sign-blank">{answered ? SIGN_CHAR[correct] : "?"}</span>
      <span className="croc-put-sign-num">{task.right}</span>
    </div>
  );

  if (answered && showLabels) {
    return (
      <button className="session-full-tap cfn-result-tap" onClick={(e) => { e.stopPropagation(); onAdvance(); }}>
        <div className="compare-instruction">{instruction}</div>
        {stage}
        <div className="compare-verdict cfn-verdict-reveal">{verdict}</div>
      </button>
    );
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{instruction}</div>
      {stage}
      <div className="cfn-multi-divider" />
      <Buttons style={style} correct={correct} answered={answered} onAnswer={handleAnswer} />
      {verdict && !showLabels && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}

function MultiMode({ task, onCorrect, onMistake, playFeedback }) {
  const items = task.items;
  const [answers,    setAnswers]    = useState(() => Array(items.length).fill(null));
  const [focusIndex, setFocusIndex] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(-1);
  const doneRef      = useRef(false);
  const onCorrectRef = useRef(onCorrect);
  useEffect(() => { onCorrectRef.current = onCorrect; });

  const style = task.style ?? "sign";

  function handleAnswer(value) {
    if (doneRef.current) return;
    const item = items[focusIndex];
    const correct = item.left > item.right ? "more" : item.left < item.right ? "less" : "equal";
    if (value !== correct) {
      setWrongFlash(focusIndex);
      onMistake?.(task.conceptId, null);
      window.setTimeout(() => setWrongFlash(-1), 420);
      return;
    }
    const next = [...answers];
    next[focusIndex] = value;
    setAnswers(next);
    const nextFocus = focusIndex + 1;
    setFocusIndex(nextFocus);
    if (nextFocus >= items.length) {
      doneRef.current = true;
      window.setTimeout(() => onCorrectRef.current(task.conceptId, null), 650);
    } else {
      playFeedback?.("correct");
    }
  }

  function signClass(i) {
    const b = "cfn-multi-sign";
    if (wrongFlash === i)   return `${b} ${b}--wrong`;
    if (answers[i] != null) return `${b} ${b}--done`;
    if (focusIndex === i)   return `${b} ${b}--active`;
    return b;
  }

  // In landscape (see comparison.css), the row list flows into two columns
  // instead of one long one — grid-auto-flow:column needs an explicit row
  // count to know when to wrap into the second column. 5 or fewer items
  // stay a single column (rows === items.length, nothing left to wrap);
  // more than that splits as evenly as possible across two.
  const multiRows = items.length <= 5 ? items.length : Math.ceil(items.length / 2);

  // How tall the row list (.cfn-multi) is allowed to be: exactly whatever's
  // left in the body after its fixed-size siblings (instruction, divider,
  // buttons) — measured directly with getBoundingClientRect rather than
  // guessed with CSS. A pure-CSS "shrink to fit" was tried first (rows as
  // flex/grid children sized off .cfn-multi's own auto flex-basis) but that
  // basis is itself a *hypothetical* size the browser estimates before the
  // real layout pass — with container-query font sizing on each row, that
  // estimate doesn't match the size .cfn-multi actually gets, and the gap
  // showed up two different ways (10 rows on a small phone silently losing
  // the bottom ones to .cfn-multi's own overflow:hidden; the button row
  // sliding off the bottom in landscape). Measuring the real, already-laid-
  // out siblings sidesteps the estimate entirely — nothing left to
  // disagree with. Runs in useLayoutEffect so the corrected height is
  // already in place before the browser paints (no visible jump), and a
  // ResizeObserver keeps it correct across rotation/resize.
  const bodyRef     = useRef(null);
  const instrRef    = useRef(null);
  const dividerRef  = useRef(null);
  const buttonsRef  = useRef(null);
  const [listHeight, setListHeight] = useState(null);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body || !instrRef.current || !dividerRef.current || !buttonsRef.current) return;

    function recalc() {
      const gap = parseFloat(getComputedStyle(body).rowGap) || 0;
      const used = instrRef.current.offsetHeight + dividerRef.current.offsetHeight + buttonsRef.current.offsetHeight + gap * 3;
      setListHeight(Math.max(0, body.clientHeight - used));
    }

    recalc();
    // Also watch the siblings themselves, not just body — a web-font swap
    // (Nunito loading in after first paint) reflows the instruction/button
    // text without necessarily resizing body itself, which would otherwise
    // leave listHeight stale from the pre-font-load measurement.
    const ro = new ResizeObserver(recalc);
    ro.observe(body);
    ro.observe(instrRef.current);
    ro.observe(buttonsRef.current);
    return () => ro.disconnect();
  }, [items.length]);

  return (
    <div
      ref={bodyRef}
      className="compare-body compare-body--multi"
      style={{ "--multi-count": items.length, "--multi-rows": multiRows, "--multi-list-h": listHeight != null ? `${listHeight}px` : undefined }}
    >
      <div ref={instrRef} className="compare-instruction">{task.instruction ?? "Поставь правильный знак между числами"}</div>
      <div className="cfn-multi">
        {items.map((item, i) => (
          <div key={i} className={`cfn-multi-row${focusIndex === i ? " cfn-multi-row--active" : ""}`}>
            <div className="cfn-multi-num">{item.left}</div>
            <div className={signClass(i)}>
              {answers[i] != null ? SIGN_CHAR[answers[i]] : focusIndex === i ? "?" : ""}
            </div>
            <div className="cfn-multi-num">{item.right}</div>
          </div>
        ))}
      </div>
      <div ref={dividerRef} className="cfn-multi-divider" />
      <div ref={buttonsRef} className="cfn-multi-buttons-wrap">
        <MultiButtons style={style} disabled={focusIndex >= items.length} onAnswer={handleAnswer} />
      </div>
    </div>
  );
}

export default function CompareEvaluate({ task, onCorrect, onIncorrect, onMistake, onAdvance, playFeedback }) {
  if (task.items) {
    return <MultiMode task={task} onCorrect={onCorrect} onMistake={onMistake} playFeedback={playFeedback} />;
  }
  return <SingleMode task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} onAdvance={onAdvance} />;
}
