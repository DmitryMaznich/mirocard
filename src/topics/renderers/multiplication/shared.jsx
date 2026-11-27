import { APPLE, BANANA } from "./assets.js";
import { layout } from "./mechanics.js";
import { BANANA_POS, lessonLanguage } from "./lesson.js";

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
                <img src={APPLE} alt="" draggable={false} style={{ animationDelay: `${(r * width + j) * 60}ms` }} />
              </span>
            );
            return <span key={j} className={`mul-rows-cell${judge && j < max ? " mul-rows-cell--gap" : ""}`} />;
          })}
        </div>
      ))}
    </div>
  );
}

// Zone 1: the line of the task and the lesson strip — one apple per finished task, so the child sees
// how much is left. Voice is off (owner, 2026-11-27): no speech and no speaker button for now;
// voice.js stays for when recorded speech arrives.
export function Top({ task, text, finished = false }) {
  const language = lessonLanguage(task);
  const total = Number.isInteger(task.total) ? task.total : 0;
  const done = (task.index ?? 0) + (finished ? 1 : 0);
  return (
    <div className="mul-top" lang={language}>
      <span className="mul-say-text" data-testid="mul-say">{text}</span>
      {total > 0 && (
        <span className="mul-strip" data-testid="mul-strip">
          {Array.from({ length: total }, (_, i) => <i key={i} className={i < done ? "on" : i === done ? "now" : ""} />)}
        </span>
      )}
    </div>
  );
}
