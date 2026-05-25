import { useState, useRef, Fragment } from "react";

const DIGIT_ROW = ["0","1","2","3","4","5","6","7","8","9"];
const ABV_ROWS = [
  ["А","Б","В","Г","Д","Е","Ё","Ж","З","И","Й"],
  ["К","Л","М","Н","О","П","Р","С","Т","У","Ф"],
  ["Х","Ц","Ч","Ш","Щ","Ъ","Ы","Ь","Э","Ю","Я"],
];
const QWERTY_ROWS = [
  ["Й","Ц","У","К","Е","Н","Г","Ш","Щ","З","Х"],
  ["Ф","Ы","В","А","П","Р","О","Л","Д","Ж","Э"],
  ["Я","Ч","С","М","И","Т","Ь","Б","Ю","Ъ","Ё"],
];
const BOTTOM_LEFT  = ["!","?"];
const BOTTOM_RIGHT = [".",","];

const VOWELS = new Set(["А","Е","Ё","И","О","У","Ы","Э","Ю","Я"]);
const SIGNS  = new Set(["Ъ","Ь"]);

let _seq = 0;
function newId() { return `ms_${++_seq}`; }

function emptyLines(n = 12) { return Array.from({ length: n }, () => []); }

function ensureTrailing(lines) {
  const safe   = Array.isArray(lines) ? lines : [];
  const rev    = [...safe].reverse();
  const ne     = rev.findIndex((l) => l.length > 0);
  const tail   = ne === -1 ? safe.length : ne;
  const toAdd  = Math.max(0, 4 - tail);
  return toAdd > 0 ? [...safe, ...emptyLines(toAdd)] : safe;
}

function normalize(text) {
  return String(text || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function getTextFromLines(lines) {
  return lines
    .map((line) => line.map((t) => (t.type === "space" ? " " : t.letter ?? "")).join(""))
    .join("\n")
    .replace(/\n+$/, "")
    .trim();
}

function getCategory(letter, letterMap) {
  const s = String(letter || "");
  if (!s || !/^[А-ЯЁ]$/u.test(s)) return "neutral";
  if (letterMap[s]) return letterMap[s];
  if (VOWELS.has(s)) return "vowel";
  if (SIGNS.has(s))  return "sign";
  return "consonant";
}

export default function MagneticSentenceView({
  task, mode, topicId,
  sessionParams, soundEnabled,
  playTopicFile, playFeedback,
  onAdvance,
}) {
  const audioMode = mode?.type === "magnetic_sentence_audio";
  const layout    = sessionParams?.layout ?? "abv";
  const kbRows    = layout === "qwerty" ? QWERTY_ROWS : ABV_ROWS;
  const sentences = task?.sentences ?? [];
  const letterMap = Object.fromEntries((task?.letters ?? []).map((l) => [l.letter, l.category]));

  const canvasRef  = useRef(null);
  const pendingRef = useRef(null);

  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [phase,       setPhase]       = useState("assemble");
  const [lines,       setLines]       = useState(() => ensureTrailing(emptyLines()));
  const [drag,        setDrag]        = useState(null);
  const [dropTarget,  setDropTarget]  = useState(null);
  const [checkResult, setCheckResult] = useState(null);

  const current       = sentences[sentenceIdx] ?? null;
  const assembledText = getTextFromLines(lines);
  const canCheck      = assembledText.trim().length > 0 && phase === "assemble" && !checkResult;

  function updateLines(fn) {
    setLines((cur) => ensureTrailing(fn(cur)));
  }

  function computeDrop(x, y, src = lines) {
    const lineEls = canvasRef.current?.querySelectorAll(".mag-line");
    if (!lineEls?.length) return null;
    let best = 0, bestD = Infinity;
    lineEls.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(y - (r.top + r.height / 2));
      if (d < bestD) { bestD = d; best = i; }
    });
    const tokens = lineEls[best].querySelectorAll(".mag-token:not(.mag-floating)");
    let ins = (src[best] ?? []).length;
    for (let i = 0; i < tokens.length; i++) {
      const r = tokens[i].getBoundingClientRect();
      if (x < r.left + r.width / 2) { ins = i; break; }
    }
    return { lineIdx: best, insertIdx: ins };
  }

  function beginFromKeyboard(e, letter, category) {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    const cat = category ?? getCategory(letter, letterMap);
    setDrag({ pointerId: e.pointerId, source: "keyboard", letter, category: cat, x: e.clientX, y: e.clientY });
    setDropTarget(computeDrop(e.clientX, e.clientY));
  }

  function beginFromCanvas(e, lineIdx, tokenIdx, token) {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    pendingRef.current = { pointerId: e.pointerId, lineIdx, tokenIdx, token, startX: e.clientX, startY: e.clientY };
  }

  function startCanvasDrag(pending, cx, cy) {
    let snap = lines;
    updateLines((cur) => {
      const next = cur.map((line, i) =>
        i === pending.lineIdx ? line.filter((_, j) => j !== pending.tokenIdx) : line
      );
      snap = ensureTrailing(next);
      return next;
    });
    setDrag({
      pointerId: pending.pointerId,
      source:   "canvas",
      letter:   pending.token.letter,
      category: pending.token.category,
      type:     pending.token.type,
      x: cx, y: cy,
    });
    setDropTarget(computeDrop(cx, cy, snap));
  }

  function handleMove(e) {
    const p = pendingRef.current;
    if (!drag && p && e.pointerId === p.pointerId) {
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) >= 10) {
        pendingRef.current = null;
        startCanvasDrag(p, e.clientX, e.clientY);
      }
      return;
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    setDrag((d) => ({ ...d, x: e.clientX, y: e.clientY }));
    setDropTarget(computeDrop(e.clientX, e.clientY));
  }

  function handleUp(e) {
    const p = pendingRef.current;
    if (!drag && p && e.pointerId === p.pointerId) {
      pendingRef.current = null;
      updateLines((cur) =>
        cur.map((line, i) =>
          i === p.lineIdx ? line.filter((_, j) => j !== p.tokenIdx) : line
        )
      );
      return;
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (dropTarget) {
      const token = {
        id:       newId(),
        type:     drag.type ?? (drag.category === "space" ? "space" : "letter"),
        letter:   drag.letter,
        category: drag.category,
      };
      updateLines((cur) =>
        cur.map((line, i) => {
          if (i !== dropTarget.lineIdx) return line;
          const next = [...line];
          next.splice(dropTarget.insertIdx, 0, token);
          return next;
        })
      );
    }
    setDrag(null);
    setDropTarget(null);
    pendingRef.current = null;
  }

  function handleCheck() {
    if (!canCheck) return;
    const correct = normalize(assembledText) === normalize(current?.text ?? "");
    if (correct) {
      setCheckResult("correct");
      if (soundEnabled) playFeedback?.("correct");
      setTimeout(() => {
        setCheckResult(null);
        setPhase("success");
        setTimeout(() => setPhase("copy"), 1500);
      }, 400);
    } else {
      setCheckResult("incorrect");
      if (soundEnabled) playFeedback?.("incorrect");
      setTimeout(() => setCheckResult(null), 1500);
    }
  }

  function handleDone() {
    const nextIdx = sentenceIdx + 1;
    if (nextIdx >= sentences.length) {
      onAdvance?.();
    } else {
      setSentenceIdx(nextIdx);
      setPhase("assemble");
      setLines(ensureTrailing(emptyLines()));
    }
  }

  async function handleListen() {
    if (current?.audio) {
      await playTopicFile?.(topicId, current.audio);
    }
  }

  if (phase === "copy") {
    return (
      <div className="mag-screen mag-copy-screen">
        <div className="mag-copy-animation">
          <span className="mag-copy-pen">✏️</span>
          <span className="mag-copy-notebook">📓</span>
        </div>
        <div className="mag-copy-text">{assembledText}</div>
        <button className="mag-copy-done-btn" onClick={handleDone}>Готово</button>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="mag-screen mag-success-screen">
        <div className="mag-success-icon">✓</div>
      </div>
    );
  }

  return (
    <div
      className="mag-screen"
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      {audioMode ? (
        <div className="mag-sentence-bar mag-sentence-bar--audio">
          <button className="mag-listen-btn" onClick={handleListen}>
            🔊 Слушать
          </button>
          {!current?.audio && current?.text && (
            <span className="mag-sentence-text">{current.text}</span>
          )}
        </div>
      ) : (
        <div className="mag-sentence-bar">
          <span className="mag-sentence-text">{current?.text ?? ""}</span>
        </div>
      )}

      <div className="mag-canvas" ref={canvasRef}>
        {lines.map((line, li) => (
          <div key={li} className={`mag-line${dropTarget?.lineIdx === li ? " drag-target" : ""}`}>
            {line.map((tok, ti) => (
              <Fragment key={tok.id}>
                {dropTarget?.lineIdx === li && dropTarget.insertIdx === ti && <div className="mag-insert-cursor" />}
                <div
                  className={`mag-token ${tok.category}`}
                  onPointerDown={(e) => beginFromCanvas(e, li, ti, tok)}
                >
                  {tok.type === "space" ? null : tok.letter}
                </div>
              </Fragment>
            ))}
            {dropTarget?.lineIdx === li && dropTarget.insertIdx === line.length && <div className="mag-insert-cursor" />}
          </div>
        ))}
      </div>

      <div className="mag-keyboard">
        <div className="mag-kb-row digits">
          {DIGIT_ROW.map((d) => (
            <button key={d} type="button" className="mag-key neutral" onPointerDown={(e) => beginFromKeyboard(e, d)}>
              {d}
            </button>
          ))}
        </div>
        {kbRows.map((row, ri) => (
          <div key={ri} className="mag-kb-row letters">
            {row.map((letter) => (
              <button
                key={letter}
                type="button"
                className={`mag-key ${getCategory(letter, letterMap)}`}
                onPointerDown={(e) => beginFromKeyboard(e, letter)}
              >
                {letter}
              </button>
            ))}
          </div>
        ))}
        <div className="mag-kb-row bottom">
          {BOTTOM_LEFT.map((s) => (
            <button key={s} type="button" className="mag-key neutral" onPointerDown={(e) => beginFromKeyboard(e, s)}>{s}</button>
          ))}
          <button type="button" className="mag-key-space" onPointerDown={(e) => beginFromKeyboard(e, null, "space")}>
            пробел
          </button>
          {BOTTOM_RIGHT.map((s) => (
            <button key={s} type="button" className="mag-key neutral" onPointerDown={(e) => beginFromKeyboard(e, s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="mag-sentence-check-bar">
        <button
          className={`mag-check-btn${checkResult ? ` mag-check-btn--${checkResult}` : ""}`}
          onClick={handleCheck}
          disabled={!canCheck}
        >
          {checkResult === "correct" ? "✓" : checkResult === "incorrect" ? "✗" : "Проверить"}
        </button>
        <span className="mag-sentence-counter">
          {sentenceIdx + 1} / {sentences.length}
        </span>
      </div>

      {drag && (
        <div
          className={`mag-token ${drag.category} mag-floating`}
          style={{ left: drag.x, top: drag.y }}
        >
          {drag.category === "space" ? "·" : drag.letter}
        </div>
      )}
    </div>
  );
}
