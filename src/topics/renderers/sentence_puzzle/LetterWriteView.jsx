import { useState, useEffect, useRef, Fragment } from "react";
import "./letter_write.css";

const DIGIT_ROW   = ["0","1","2","3","4","5","6","7","8","9"];
const ABV_ROWS    = [
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
const BOTTOM_RIGHT = [".","," ];

const VOWELS = new Set(["А","Е","Ё","И","О","У","Ы","Э","Ю","Я"]);
const SIGNS  = new Set(["Ъ","Ь"]);

const KEY_W  = "clamp(24px, 3.6vw, 40px)";
const KEY_H  = "clamp(30px, 4.8vw, 46px)";
const KEY_FS = "clamp(14px, 2.1vw, 22px)";
const ROW_H  = "calc(clamp(30px, 4.8vw, 46px) + 14px)";

let _seq = 0;
function newId() { return `lw_${++_seq}`; }

function emptyLines(n = 10) { return Array.from({ length: n }, () => []); }

function ensureTrailing(lines) {
  const safe   = Array.isArray(lines) ? lines : [];
  const rev    = [...safe].reverse();
  const ne     = rev.findIndex((l) => l.length > 0);
  const tail   = ne === -1 ? safe.length : ne;
  const toAdd  = Math.max(0, 3 - tail);
  return toAdd > 0 ? [...safe, ...emptyLines(toAdd)] : safe;
}

function normalize(t) {
  return String(t || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function linesText(lines) {
  return lines
    .map((l) => l.map((t) => (t.type === "space" ? " " : t.letter ?? "")).join(""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function speakRu(text, { onStart, onEnd } = {}) {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  synth.cancel();
  const utt  = new SpeechSynthesisUtterance(text);
  utt.lang   = "ru-RU";
  utt.rate   = 0.85;
  utt.onstart = onStart;
  utt.onend   = onEnd;
  utt.onerror = onEnd;
  synth.speak(utt);
  return () => synth.cancel();
}

export default function LetterWriteView({
  task, sessionParams, topicId, soundEnabled, playTopicFile, playFeedback, onCorrect, onAdvance,
}) {
  const layout     = sessionParams?.layout ?? "abv";
  const kbRows     = layout === "qwerty" ? QWERTY_ROWS : ABV_ROWS;
  const spaceLabel = layout === "qwerty" ? "пробел" : "пробел";

  const slotTypes    = task.structure === "simple" ? ["subject","verb"] : ["subject","verb","adjective","object"];
  const sentenceText = slotTypes.map((t) => task.target[t]?.pronounce ?? task.target[t]?.label ?? "").join(" ");
  const targetText   = slotTypes.map((t) => task.target[t]?.label ?? "").join(" ");

  const hasTts  = !!window.speechSynthesis;
  const MAX_REPLAYS = 3;

  const canvasRef  = useRef(null);
  const pendingRef = useRef(null);
  const ttsCancel  = useRef(null);

  const [lines,       setLines]       = useState(() => ensureTrailing(emptyLines()));
  const [drag,        setDrag]        = useState(null);
  const [dropTarget,  setDropTarget]  = useState(null);
  const [speaking,    setSpeaking]    = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [checkResult, setCheckResult] = useState(null);

  function getCategory(s) {
    if (!s || !/^[А-ЯЁ]$/u.test(s)) return "neutral";
    if (VOWELS.has(s)) return "vowel";
    if (SIGNS.has(s))  return "sign";
    return "consonant";
  }

  function updateLines(fn) { setLines((cur) => ensureTrailing(fn(cur))); }

  // Auto-play on mount
  useEffect(() => {
    if (!soundEnabled) return;
    if (task.audioPath) {
      playTopicFile(topicId, task.audioPath);
    } else if (hasTts) {
      const t = setTimeout(() => {
        ttsCancel.current = speakRu(sentenceText, {
          onStart: () => setSpeaking(true),
          onEnd:   () => setSpeaking(false),
        });
      }, 350);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { ttsCancel.current?.(); }, []);

  function handleReplay() {
    if (replayCount >= MAX_REPLAYS) return;
    setReplayCount((c) => c + 1);
    ttsCancel.current?.();
    if (task.audioPath) {
      if (soundEnabled) playTopicFile(topicId, task.audioPath);
    } else if (hasTts) {
      ttsCancel.current = speakRu(sentenceText, {
        onStart: () => setSpeaking(true),
        onEnd:   () => setSpeaking(false),
      });
    }
  }

  // ── Drag mechanics ──────────────────────────────────────────
  function computeDrop(x, y, src = lines) {
    const lineEls = canvasRef.current?.querySelectorAll(".lw-line");
    if (!lineEls?.length) return null;
    let best = 0, bestD = Infinity;
    lineEls.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(y - (r.top + r.height / 2));
      if (d < bestD) { bestD = d; best = i; }
    });
    const tokens = lineEls[best].querySelectorAll(".lw-token:not(.lw-floating)");
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
    setDrag({ pointerId: e.pointerId, letter, category: cat, x: e.clientX, y: e.clientY });
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
    setDrag({ pointerId: pending.pointerId, letter: pending.token.letter, category: pending.token.category, type: pending.token.type, x: cx, y: cy });
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
      updateLines((cur) => cur.map((l, i) => i === p.lineIdx ? l.filter((_, j) => j !== p.tokenIdx) : l));
      return;
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (dropTarget) {
      const token = { id: newId(), type: drag.type ?? (drag.category === "space" ? "space" : "letter"), letter: drag.letter, category: drag.category };
      updateLines((cur) => cur.map((l, i) => {
        if (i !== dropTarget.lineIdx) return l;
        const next = [...l];
        next.splice(dropTarget.insertIdx, 0, token);
        return next;
      }));
    }
    setDrag(null);
    setDropTarget(null);
    pendingRef.current = null;
  }

  // ── Check ───────────────────────────────────────────────────
  function handleCheck() {
    if (checkResult) return;
    const assembled = linesText(lines);
    const normA = normalize(assembled);
    const normT = normalize(targetText);
    if (normA !== normT) {
      console.log("[lw-check] assembled:", JSON.stringify(normA));
      console.log("[lw-check] target:  ", JSON.stringify(normT));
    }
    const correct = normA === normT;
    if (soundEnabled && !correct) playFeedback?.("incorrect");
    setCheckResult(correct ? "correct" : "incorrect");
    if (correct) {
      onCorrect();
      setTimeout(() => onAdvance?.(), 1500);
    } else {
      setTimeout(() => setCheckResult(null), 1500);
    }
  }

  const hasContent = lines.some((l) => l.length > 0);

  return (
    <div
      className="lw-screen"
      style={{ "--lw-key-w": KEY_W, "--lw-key-h": KEY_H, "--lw-key-fs": KEY_FS, "--lw-row-h": ROW_H }}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      {/* Audio header */}
      <div className="lw-audio-section">
        {(task.audioPath || hasTts) ? (
          <>
            <button
              className={`lw-audio-btn${speaking ? " lw-audio-btn--speaking" : ""}${replayCount >= MAX_REPLAYS ? " lw-audio-btn--exhausted" : ""}`}
              onClick={handleReplay}
              disabled={replayCount >= MAX_REPLAYS}
              aria-label="Прослушать предложение"
            >
              🔊
            </button>
            <div className="lw-audio-dots">
              {Array.from({ length: MAX_REPLAYS }, (_, i) => (
                <span key={i} className={`lw-audio-dot${i < replayCount ? " lw-audio-dot--used" : ""}`} />
              ))}
            </div>
          </>
        ) : (
          <div className="lw-audio-prompt">
            <span className="lw-audio-prompt__label">Произнесите вслух:</span>
            <span className="lw-audio-prompt__sentence">{sentenceText}</span>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="lw-canvas" ref={canvasRef}>
        {lines.map((line, li) => (
          <div key={li} className={`lw-line${dropTarget?.lineIdx === li ? " drag-target" : ""}`}>
            {line.map((tok, ti) => (
              <Fragment key={tok.id}>
                {dropTarget?.lineIdx === li && dropTarget.insertIdx === ti && <div className="lw-insert-cursor" />}
                <div
                  className={`lw-token ${tok.category}`}
                  onPointerDown={(e) => beginFromCanvas(e, li, ti, tok)}
                >
                  {tok.type === "space" ? null : tok.letter}
                </div>
              </Fragment>
            ))}
            {dropTarget?.lineIdx === li && dropTarget.insertIdx === line.length && <div className="lw-insert-cursor" />}
          </div>
        ))}
      </div>

      {/* Check bar */}
      {hasContent && (
        <div className="lw-check-bar">
          <button
            className={`lw-check-btn${checkResult ? ` lw-check-btn--${checkResult}` : ""}`}
            onClick={handleCheck}
            disabled={!!checkResult}
          >
            {checkResult === "correct" ? "✓ Верно!" : checkResult === "incorrect" ? "✗ Попробуй ещё" : "Проверить"}
          </button>
        </div>
      )}

      {/* Keyboard */}
      <div className="lw-keyboard">
        <div className="lw-kb-row digits">
          {DIGIT_ROW.map((d) => (
            <button key={d} type="button" className="lw-key neutral" onPointerDown={(e) => beginFromKeyboard(e, d)}>{d}</button>
          ))}
        </div>
        {kbRows.map((row, ri) => (
          <div key={ri} className="lw-kb-row letters">
            {row.map((letter) => (
              <button key={letter} type="button" className={`lw-key ${getCategory(letter)}`} onPointerDown={(e) => beginFromKeyboard(e, letter)}>
                {letter}
              </button>
            ))}
          </div>
        ))}
        <div className="lw-kb-row bottom">
          {BOTTOM_LEFT.map((s) => (
            <button key={s} type="button" className="lw-key neutral" onPointerDown={(e) => beginFromKeyboard(e, s)}>{s}</button>
          ))}
          <button type="button" className="lw-key-space" onPointerDown={(e) => beginFromKeyboard(e, null, "space")}>
            {spaceLabel}
          </button>
          {BOTTOM_RIGHT.map((s) => (
            <button key={s} type="button" className="lw-key neutral" onPointerDown={(e) => beginFromKeyboard(e, s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Floating ghost */}
      {drag && (
        <div className={`lw-token ${drag.category} lw-floating`} style={{ left: drag.x, top: drag.y }}>
          {drag.category === "space" ? "·" : drag.letter}
        </div>
      )}
    </div>
  );
}
