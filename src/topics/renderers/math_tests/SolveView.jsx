import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import SheetSvg from "./SheetSvg";
import { layoutTest, blanksOf } from "./layout.js";
import { blockTitle, isAnswerRight } from "./blocks.js";
import { usePdfSaver } from "./PdfDialog";
import { makeTestPdf, pdfFileName } from "./pdf.js";
import { NARROW_QUERY, useMediaQuery } from "./hooks.js";
import { IconBack, IconVideo } from "./icons";

// how big one notebook cell is on screen while solving; 24 on a phone so two column examples stand side by side
const CELL_PX = { wide: 27, narrow: 24 };
const MIN_CELL_PX = 22; // a slightly wider example gets cells this small before it is broken into lines

const SIGN_KEYS = [{ v: "add", label: "+", aria: "Плюс" }, { v: "subtract", label: "−", aria: "Минус" }];
const CMP_KEYS = [{ v: "<", label: "<", aria: "Меньше" }, { v: "=", label: "=", aria: "Равно" }, { v: ">", label: ">", aria: "Больше" }];
const SIGN_VALUES = { sign: ["add", "subtract"], cmp: ["<", ">", "="] };

// digits on the left; on the right the sign keys the test needs (+ − and/or < = >) over ⌫ →.
// Only the keys that fit the focused box are active.
function Numpad({ kind, kinds, onDigit, onSign, onErase, onNext, onUp }) {
  const showCmp = kinds.has("cmp");
  // + − only when the test has a sign box (or nothing else: the keypad keeps its old shape)
  const showSign = kinds.has("sign") || (!showCmp && !onUp);
  const signs = [...(showSign ? SIGN_KEYS.map((k) => ({ ...k, kind: "sign" })) : []), ...(showCmp ? CMP_KEYS.map((k) => ({ ...k, kind: "cmp" })) : [])];
  const cols = Math.max(2, signs.length);
  return (
    <div className={`mt-pad${kind !== "num" ? " is-sign" : ""}`} role="group" aria-label="Клавиатура" style={{ "--mt-side-cols": cols }}>
      <div className="mt-pad-digits">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
          <button key={d} type="button" className="mt-key" disabled={kind !== "num"} onClick={() => onDigit(String(d))}>{d}</button>
        ))}
      </div>
      <div className="mt-pad-side">
        {signs.map((k) => (
          <button key={k.v} type="button" className={`mt-key mt-key--sign${kind === k.kind ? " is-active" : ""}`} disabled={kind !== k.kind} onClick={() => onSign(k.v)} aria-label={k.aria}>{k.label}</button>
        ))}
        <button type="button" className="mt-key mt-key--fn" style={{ gridColumn: cols > 2 ? `span ${cols - 1}` : undefined }} onClick={onErase} aria-label="Стереть">⌫</button>
        <button type="button" className="mt-key mt-key--fn" onClick={onNext} aria-label="Следующая клетка">→</button>
        {onUp && (
          <button type="button" className="mt-key mt-key--fn mt-key--up" style={{ gridColumn: `span ${cols}` }} onClick={onUp} aria-label="Пометка сверху: перенос или заём">↑ сверху</button>
        )}
      </div>
    </div>
  );
}

// «Решать на экране»: the same sheet, the child fills the boxes with the keypad at the bottom (one
// digit per cell; + and − for a sign box, < = > for a comparison). «Проверить» marks everything at once: right boxes green,
// a wrong one red with the right answer over it, the score and each block's result. From there:
// «Исправить ошибки» (only the wrong boxes open again), «Решать заново», and — when the test has
// «Видеоприз» on, every box was filled and the student has videos — «Смотреть видео».
export default function SolveView({ test, onBack, onResult }) {
  const narrow = useMediaQuery(NARROW_QUERY);
  const canvasRef = useRef(null);
  const [width, setWidth] = useState(() => (typeof window !== "undefined" ? Math.min(window.innerWidth, 1100) : 800));
  const cellPx = narrow ? CELL_PX.narrow : CELL_PX.wide;
  // the blocks are laid out for this screen's width (not the paper's): as many cells as fit, one long page
  const screenCols = Math.max(12, Math.min(48, Math.floor((width - 16) / cellPx) - 1));
  const maxScreenCols = Math.max(screenCols, Math.min(48, Math.floor((width - 16) / MIN_CELL_PX) - 1));
  const layout = useMemo(() => layoutTest(test, { screenCols, maxScreenCols }), [test, screenCols, maxScreenCols]);
  const blanks = useMemo(() => blanksOf(layout), [layout]);
  // the answers; marks (carries / borrowed digits over a column) are the child's help, never graded
  const graded = useMemo(() => blanks.filter((b) => !b.aux), [blanks]);
  const byKey = useMemo(() => Object.fromEntries(blanks.map((b) => [b.key, b])), [blanks]);

  const [values, setValues] = useState({});
  const [locked, setLocked] = useState(() => new Set());
  const [marks, setMarks] = useState(null);
  const [focus, setFocus] = useState(graded[0]?.key ?? null);
  const [prize, setPrize] = useState("none"); // none | ready | watching | used

  const students = useAppStore((s) => s.students);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const student = students?.find((s) => s.id === activeStudentId) ?? null;
  const hasVideos = (student?.rewardVideos?.length ?? 0) > 0;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // a cell of cellPx; smaller only if a block's widest example needs more cells than fit (not below 20 px)
  const scale = Math.max(MIN_CELL_PX, Math.min(cellPx, (width - 16) / (layout.grid.w / layout.grid.cell))) / layout.grid.cell;

  const open = useMemo(() => graded.filter((b) => !locked.has(b.key)), [graded, locked]);
  const filled = graded.filter((b) => (values[b.key] ?? "") !== "").length;
  const checked = marks !== null;

  // the focused box stays in view (the sheet scrolls itself on a phone)
  useEffect(() => {
    if (!focus || checked) return;
    const el = canvasRef.current?.querySelector(`[data-blank="${focus}"]`);
    el?.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
  }, [focus, checked]);

  const nextOpen = useCallback((key, dir = 1) => {
    const i = open.findIndex((b) => b.key === key);
    if (open.length === 0) return null;
    if (i < 0) return open[0].key;
    const j = i + dir;
    return j >= 0 && j < open.length ? open[j].key : null;
  }, [open]);

  // the answer box of the same column example (back from a mark)
  const answerOf = useCallback((item) => graded.find((x) => x.item === item)?.key ?? null, [graded]);
  const typeDigit = useCallback((d) => {
    if (!focus || checked) return;
    const b = byKey[focus];
    if (!b || locked.has(focus)) return;
    if (b.kind === "mark") {
      // a carry / a borrowed digit: one digit over the column, then back to the answer
      setValues((v) => ({ ...v, [focus]: d }));
      const a = answerOf(b.item);
      if (a && !locked.has(a)) setFocus(a);
      return;
    }
    if (b.kind !== "num") return;
    const cur = values[focus] ?? "";
    // a column answer is written from the right: each new digit goes in front
    const next = cur.length >= b.w ? d : b.rtl ? d + cur : cur + d;
    setValues((v) => ({ ...v, [focus]: next }));
    if (next.length >= b.w) { const n = nextOpen(focus); if (n) setFocus(n); }
  }, [focus, checked, byKey, locked, values, nextOpen, answerOf]);
  // «↑ сверху»: from a column answer to the mark over the next place (where the carry goes, or the
  // digit borrowed from)
  const goUp = useCallback(() => {
    if (!focus || checked) return;
    const b = byKey[focus];
    if (!b) return;
    const markKeys = blanks.filter((x) => x.aux && x.item === b.item);
    if (!markKeys.length) return;
    // after writing the digit of place k the carry goes over place k (counted from the units = 0):
    // the units written (1 digit) → over the tens (1)
    const pos = b.aux ? b.pos : Math.min(Math.max(1, (values[focus] ?? "").length), markKeys.length - 1);
    const m = markKeys.find((x) => x.pos === pos) ?? markKeys.at(-1);
    setFocus(m.key);
  }, [focus, checked, byKey, blanks, values]);
  // a tap on a digit of the top number crosses it out (a borrow) or back; crossing out goes on to the
  // mark over it, where the new digit is written
  const toggleCross = useCallback((key) => {
    if (checked) return;
    const crossing = !values[key];
    setValues((v) => ({ ...v, [key]: crossing ? "x" : "" }));
    if (crossing) {
      const markKey = key.replace(/:x(\d+)$/, ":m$1");
      if (byKey[markKey]) setFocus(markKey);
    }
  }, [checked, values, byKey]);
  const typeSign = useCallback((op) => {
    if (!focus || checked) return;
    const b = byKey[focus];
    if (!b || !SIGN_VALUES[b.kind]?.includes(op) || locked.has(focus)) return;
    setValues((v) => ({ ...v, [focus]: op }));
    const n = nextOpen(focus);
    if (n) setFocus(n);
  }, [focus, checked, byKey, locked, nextOpen]);
  const erase = useCallback(() => {
    if (!focus || checked || locked.has(focus)) return;
    const cur = values[focus] ?? "";
    if (cur === "") {
      const p = nextOpen(focus, -1);
      if (p) setFocus(p);
      return;
    }
    const b = byKey[focus];
    setValues((v) => ({ ...v, [focus]: b?.kind === "num" ? (b.rtl ? cur.slice(1) : cur.slice(0, -1)) : "" }));
  }, [focus, checked, locked, values, nextOpen, byKey]);
  const goNext = useCallback(() => { const n = nextOpen(focus); setFocus(n ?? open[0]?.key ?? null); }, [focus, nextOpen, open]);

  useEffect(() => {
    if (checked) return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (/^[0-9]$/.test(e.key)) typeDigit(e.key);
      else if (e.key === "+") typeSign("add");
      else if (e.key === "-" || e.key === "−") typeSign("subtract");
      else if (e.key === "<" || e.key === ">" || e.key === "=") typeSign(e.key);
      else if (e.key === "Backspace") erase();
      else if (e.key === "Enter" || e.key === "Tab" || e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") { const p = nextOpen(focus, -1); if (p) setFocus(p); }
      else if (e.key === "ArrowUp") goUp();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checked, typeDigit, typeSign, erase, goNext, nextOpen, focus, goUp]);

  function check() {
    const m = {};
    for (const b of graded) m[b.key] = isAnswerRight(b.answer, values[b.key]) ? "right" : "wrong";
    setMarks(m);
    const right = Object.values(m).filter((x) => x === "right").length;
    onResult?.({ right, total: graded.length, at: Date.now() });
    if (test.videoPrize && hasVideos && filled === graded.length && prize === "none") setPrize("ready");
    canvasRef.current?.scrollTo?.({ top: 0, left: 0, behavior: "smooth" });
  }
  function fixErrors() {
    const keepRight = new Set(graded.filter((b) => marks?.[b.key] === "right").map((b) => b.key));
    setLocked(keepRight);
    // wrong answers are cleared; the child's marks and crossings stay
    setValues((v) => Object.fromEntries(Object.entries(v).filter(([k]) => keepRight.has(k) || !byKey[k] || byKey[k].aux)));
    setMarks(null);
    setFocus(graded.find((b) => !keepRight.has(b.key))?.key ?? null);
  }
  function restart() {
    setLocked(new Set());
    setValues({});
    setMarks(null);
    setFocus(graded[0]?.key ?? null);
  }

  const right = marks ? Object.values(marks).filter((x) => x === "right").length : 0;
  const perBlock = useMemo(() => {
    if (!marks) return [];
    const rows = [];
    for (const p of layout.pages) for (const b of p.blocks) {
      const keys = graded.filter((x) => x.blockId === b.block.id).map((x) => x.key);
      rows.push({ no: b.no, title: blockTitle(b.block), right: keys.filter((k) => marks[k] === "right").length, total: keys.length });
    }
    return rows;
  }, [marks, layout, graded]);

  const childPdf = usePdfSaver();
  const focusKind = byKey[focus]?.kind === "mark" ? "num" : byKey[focus]?.kind ?? "num";
  const kinds = useMemo(() => new Set(blanks.map((b) => b.kind)), [blanks]);
  const hasMarks = kinds.has("mark");
  const lockedMarks = !checked && locked.size ? Object.fromEntries([...locked].map((k) => [k, "right"])) : null;

  if (prize === "watching") {
    return (
      <RewardVideoModal
        rewardVideos={student?.rewardVideos ?? []}
        studentId={student?.id}
        title="Контрольная решена — молодец!"
        continueLabel="Вернуться к листу"
        onDismiss={() => setPrize("used")}
      />
    );
  }

  const prizeButton = prize === "ready" && (
    <button type="button" className="mt-prize" onClick={() => setPrize("watching")}><IconVideo />Смотреть видео</button>
  );
  const scoreCard = checked && (
    <div className="mt-score">
      <span className="mt-score-cap">Верно</span>
      <b className="mt-score-num">{right} <span>из {graded.length}</span></b>
      <span className="mt-score-sub">{right === graded.length ? "Без ошибок!" : `Ошибок: ${graded.length - right}`}</span>
      {prizeButton}
    </div>
  );

  return (
    <div className={`screen mt-root mt-solve${narrow ? " mt-solve--phone" : ""}${checked ? " is-checked" : ""}`} data-testid="math-tests-solve">
      <div className="screen-header mt-header">
        <button className="back-btn" onClick={onBack} aria-label="В редактор"><IconBack /></button>
        <div className="mt-solve-title">
          <b>{test.title || "Контрольная"}</b>
          {!checked && <span className="mt-progress"><span className="mt-progress-bar"><span style={{ width: `${graded.length ? (filled / graded.length) * 100 : 0}%` }} /></span>{narrow ? "" : "заполнено "}{filled} из {graded.length}</span>}
          {checked && <span className="mt-progress">верно {right} из {graded.length}</span>}
        </div>
        {!checked && <button type="button" className="mt-solve-btn" onClick={check} disabled={filled === 0}>Проверить</button>}
        {checked && !narrow && <>
          <button type="button" className="mt-ghost-btn" disabled={childPdf.job?.status === "making"} onClick={() => (childPdf.job?.status === "ready" ? childPdf.save() : childPdf.make(pdfFileName(`${test.title} — решение`), () => makeTestPdf(test, { values, marks })))}>
            {childPdf.job?.status === "making" ? "Готовлю PDF…" : childPdf.job?.status === "ready" ? "Сохранить PDF" : "PDF с решением"}
          </button>
          <button type="button" className="mt-ghost-btn" onClick={restart}>Решать заново</button>
          {right < graded.length && <button type="button" className="mt-solve-btn" onClick={fixErrors}>Исправить ошибки</button>}
        </>}
      </div>

      <div className="mt-solve-body">
        <div className="mt-canvas mt-canvas--solve" ref={canvasRef}>
          {narrow && scoreCard}
          {layout.pages.map((p, i) => (
            <div key={i} className="mt-page">
              <SheetSvg
                layout={layout}
                pageIndex={i}
                test={test}
                scale={scale}
                values={values}
                marks={marks ?? lockedMarks}
                focus={checked ? null : focus}
                onFocusBlank={checked ? undefined : (k) => { if (!locked.has(k)) setFocus(k); }}
                onToggleCross={checked ? undefined : toggleCross}
              />
            </div>
          ))}
        </div>
        {checked && !narrow && (
          <aside className="mt-result-side">
            {scoreCard}
            <div className="mt-result-blocks">
              <b>По заданиям</b>
              {perBlock.map((r) => (
                <div key={r.no} className="mt-result-row">
                  <span>{r.no}. {r.title}</span>
                  <b className={r.right === r.total ? "is-ok" : "is-bad"}>{r.right} из {r.total}</b>
                </div>
              ))}
            </div>
            <p className="mt-muted">Зелёная клетка — верно. Красная — ошибка, над ней правильный ответ. «Исправить ошибки» откроет только неверные клетки.</p>
          </aside>
        )}
      </div>

      {!checked && <Numpad kind={focusKind} kinds={kinds} onDigit={typeDigit} onSign={typeSign} onErase={erase} onNext={goNext} onUp={hasMarks ? goUp : undefined} />}
      {checked && narrow && (
        <div className="mt-phone-actions">
          <button type="button" className="mt-ghost-btn" onClick={restart}>Заново</button>
          {right < graded.length && <button type="button" className="mt-solve-btn" onClick={fixErrors}>Исправить ошибки</button>}
        </div>
      )}
    </div>
  );
}
