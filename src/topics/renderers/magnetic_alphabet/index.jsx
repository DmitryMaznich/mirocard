import { useState, useEffect, useRef, Fragment } from "react";
import "./magnetic_alphabet.css";

const DIGIT_ROW = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const ABV_ROWS = [
  ["А", "Б", "В", "Г", "Д", "Е", "Ё", "Ж", "З", "И", "Й"],
  ["К", "Л", "М", "Н", "О", "П", "Р", "С", "Т", "У", "Ф"],
  ["Х", "Ц", "Ч", "Ш", "Щ", "Ъ", "Ы", "Ь", "Э", "Ю", "Я"],
];

const QWERTY_ROWS = [
  ["Й", "Ц", "У", "К", "Е", "Н", "Г", "Ш", "Щ", "З", "Х"],
  ["Ф", "Ы", "В", "А", "П", "Р", "О", "Л", "Д", "Ж", "Э"],
  ["Я", "Ч", "С", "М", "И", "Т", "Ь", "Б", "Ю", "Ъ", "Ё"],
];

const BOTTOM_LEFT  = ["!", "?"];
const BOTTOM_RIGHT = [".", ","];

let _tokenSeq = 0;
function newId() { return `t_${++_tokenSeq}`; }

function emptyLines(n = 12) { return Array.from({ length: n }, () => []); }

function ensureTrailing(lines) {
  const safe    = Array.isArray(lines) ? lines : [];
  const rev     = [...safe].reverse();
  const nonEmpty = rev.findIndex((l) => l.length > 0);
  const tail    = nonEmpty === -1 ? safe.length : nonEmpty;
  const toAdd   = Math.max(0, 4 - tail);
  return toAdd > 0 ? [...safe, ...emptyLines(toAdd)] : safe;
}

function normalize(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function getTextFromLines(lines) {
  return lines
    .map((line) => line.map((t) => (t.type === "space" ? " " : t.letter ?? "")).join(""))
    .join("\n");
}

export default function MagneticAlphabetRenderer({ task, mode, sessionParams, soundEnabled, playFeedback }) {
  const layout     = sessionParams?.layout ?? "abv";
  const isWords    = mode?.type === "magnetic_words";
  const kbRows     = layout === "qwerty" ? QWERTY_ROWS : ABV_ROWS;
  const spaceLabel = layout === "qwerty" ? "пробел" : "новое слово";
  const letterMap  = Object.fromEntries((task?.letters ?? []).map((l) => [l.letter, l.category]));

  const canvasRef  = useRef(null);
  const pendingRef = useRef(null);

  const [lines,       setLines]       = useState(() => ensureTrailing(emptyLines()));
  const [drag,        setDrag]        = useState(null);
  const [dropTarget,  setDropTarget]  = useState(null);
  const [spiralN,     setSpiralN]     = useState(11);
  const [prompt,      setPrompt]      = useState("");
  const [checkResult, setCheckResult] = useState(null); // "correct" | "incorrect" | null

  function getCategory(symbol) {
    if (/^[А-ЯЁ]$/u.test(String(symbol || ""))) return letterMap[symbol] ?? "consonant";
    return "neutral";
  }

  function updateLines(fn) {
    setLines((cur) => ensureTrailing(fn(cur)));
  }

  // Resize spiral count
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => setSpiralN(Math.max(11, Math.min(28, Math.floor((el.clientWidth - 24) / 34))));
    update();
    if (typeof ResizeObserver === "function") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Reset canvas when layout changes
  useEffect(() => {
    setLines(ensureTrailing(emptyLines()));
    setDrag(null);
    setDropTarget(null);
    pendingRef.current = null;
  }, [layout]);

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
    const cat = category ?? getCategory(letter);
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
    if (checkResult) return;
    const assembled = getTextFromLines(lines);
    const correct   = normalize(assembled) === normalize(prompt);
    if (soundEnabled) playFeedback?.(correct ? "correct" : "incorrect");
    setCheckResult(correct ? "correct" : "incorrect");
    setTimeout(() => setCheckResult(null), 1500);
  }

  return (
    <div
      className="mag-screen"
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      {/* Задание (только в режиме "Сборка по заданию") */}
      {isWords && (
        <div className="mag-prompt-bar">
          <input
            className="mag-prompt-input"
            type="text"
            placeholder="Введите слово или фразу…"
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setCheckResult(null); }}
          />
          {prompt && (
            <button
              className={`mag-check-btn${checkResult ? ` mag-check-btn--${checkResult}` : ""}`}
              onClick={handleCheck}
              disabled={!!checkResult}
            >
              {checkResult === "correct" ? "✓" : checkResult === "incorrect" ? "✗" : "Проверить"}
            </button>
          )}
        </div>
      )}

      {/* Canvas */}
      <div className="mag-canvas" ref={canvasRef}>
        <div className="mag-spiral" aria-hidden>
          {Array.from({ length: spiralN }, (_, i) => <span key={i} className="mag-spiral-ring" />)}
        </div>
        <div className="mag-spiral-holes" aria-hidden>
          {Array.from({ length: spiralN }, (_, i) => <span key={i} className="mag-spiral-hole" />)}
        </div>
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

      {/* Keyboard */}
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
                className={`mag-key ${getCategory(letter)}`}
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
          <button
            type="button"
            className="mag-key-space"
            onPointerDown={(e) => beginFromKeyboard(e, null, "space")}
          >
            {spaceLabel}
          </button>
          {BOTTOM_RIGHT.map((s) => (
            <button key={s} type="button" className="mag-key neutral" onPointerDown={(e) => beginFromKeyboard(e, s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Floating ghost */}
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
