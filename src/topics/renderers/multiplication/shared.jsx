import { useEffect } from "react";
import { APPLE, BANANA } from "./assets.js";
import { layout } from "./mechanics.js";
import { BANANA_POS, lessonLanguage } from "./lesson.js";
import { speakLesson, stopLessonVoice } from "./voice.js";

export function Items({ kind = "apple", count, positions }) {
  if (kind === "egg") {
    return (positions ?? layout(count)).map(([x, y], i) => (
      <span key={i} className="mul-egg" data-item="" style={{ left: `${x}%`, top: `${y}%` }} />
    ));
  }
  if (kind === "banana") {
    return (BANANA_POS[count] ?? []).map(([x, y, r], i) => (
      <img key={i} className="mul-item" data-item="" src={BANANA} alt="" draggable={false}
        style={{ left: `${x}%`, top: `${y}%`, width: "60%", transform: `translate(-50%, -50%) rotate(${r}deg)` }} />
    ));
  }
  const width = count > 8 ? 18 : count >= 5 ? 25 : count === 1 ? 36 : 29;
  return (positions ?? layout(count)).map(([x, y], i) => (
    <img key={i} className="mul-item" data-item="" src={APPLE} alt="" draggable={false}
      style={{ left: `${x}%`, top: `${y}%`, width: `${width}%` }} />
  ));
}

export function Group({ kind = "apple", count, positions, className = "", button = false, size = 320, children, ...rest }) {
  const Tag = button ? "button" : "div";
  return (
    <Tag type={button ? "button" : undefined} className={`mul-group${kind === "egg" ? " mul-group--box" : ""} ${className}`}
      style={{ "--s": `${size}px` }} {...rest}>
      <Items kind={kind} count={count} positions={positions} />
      {children}
    </Tag>
  );
}

// One-to-one rows: `judge` marks the extra items and the gaps of the shorter row.
export function Rows({ counts, judge = true }) {
  const min = Math.min(...counts), max = Math.max(...counts), width = Math.max(6, max);
  return (
    <div className="mul-rows" data-testid="mul-rows">
      {counts.map((n, r) => (
        <div className="mul-rows-line" key={r}>
          {Array.from({ length: width }, (_, j) => {
            if (j < n) return (
              <span key={j} className={`mul-rows-cell${judge && j >= min ? " mul-rows-cell--extra" : ""}`}>
                <img src={APPLE} alt="" draggable={false} style={{ animationDelay: judge ? `${j * 80}ms` : "0ms" }} />
              </span>
            );
            return <span key={j} className={`mul-rows-cell${judge && j < max ? " mul-rows-cell--gap" : ""}`} />;
          })}
        </div>
      ))}
    </div>
  );
}

// The spoken line: shown on screen, said aloud when it changes, repeated by the speaker button.
export function Say({ task, text, soundEnabled }) {
  const language = lessonLanguage(task);
  useEffect(() => { speakLesson(text, language, { enabled: soundEnabled }); }, [text, language, soundEnabled]);
  useEffect(() => () => stopLessonVoice(), []);
  return (
    <div className="mul-say" lang={language}>
      <button type="button" className="mul-speak" aria-label="🔊" onClick={() => speakLesson(text, language, { enabled: true })}>🔊</button>
      <span className="mul-say-text" data-testid="mul-say">{text}</span>
    </div>
  );
}
