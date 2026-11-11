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

const CELL_PX = { wide: 27, narrow: 26 }; // how big one notebook cell is on screen while solving

function Numpad({ sign, onDigit, onSign, onErase, onNext }) {
  return (
    <div className={`mt-pad${sign ? " is-sign" : ""}`} role="group" aria-label="Клавиатура">
      <div className="mt-pad-digits">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
          <button key={d} type="button" className="mt-key" disabled={sign} onClick={() => onDigit(String(d))}>{d}</button>
        ))}
      </div>
      <div className="mt-pad-side">
        <button type="button" className="mt-key mt-key--sign" disabled={!sign} onClick={() => onSign("add")} aria-label="Плюс">+</button>
        <button type="button" className="mt-key mt-key--sign" disabled={!sign} onClick={() => onSign("subtract")} aria-label="Минус">−</button>
        <button type="button" className="mt-key mt-key--fn" onClick={onErase} aria-label="Стереть">⌫</button>
        <button type="button" className="mt-key mt-key--fn" onClick={onNext} aria-label="Следующая клетка">→</button>
      </div>
    </div>
  );
}

// «Решать на экране»: the same sheet, the child fills the boxes with the keypad at the bottom (one
// digit per cell; + and − for a sign box). «Проверить» marks everything at once: right boxes green,
// a wrong one red with the right answer over it, the score and each block's result. From there:
// «Исправить ошибки» (only the wrong boxes open again), «Решать заново», and — when the test has
// «Видеоприз» on, every box was filled and the student has videos — «Смотреть видео».
export default function SolveView({ test, onBack, onResult }) {
  const narrow = useMediaQuery(NARROW_QUERY);
  const layout = useMemo(() => layoutTest(test), [test]);
  const blanks = useMemo(() => blanksOf(layout), [layout]);
  const byKey = useMemo(() => Object.fromEntries(blanks.map((b) => [b.key, b])), [blanks]);

  const [values, setValues] = useState({});
  const [locked, setLocked] = useState(() => new Set());
  const [marks, setMarks] = useState(null);
  const [focus, setFocus] = useState(blanks[0]?.key ?? null);
  const [prize, setPrize] = useState("none"); // none | ready | watching | used
  const canvasRef = useRef(null);
  const [width, setWidth] = useState(800);

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
  const cellPx = narrow ? CELL_PX.narrow : CELL_PX.wide;
  const scale = narrow ? cellPx / layout.grid.cell : Math.min(cellPx / layout.grid.cell, (width - 32) / layout.grid.w);

  const open = useMemo(() => blanks.filter((b) => !locked.has(b.key)), [blanks, locked]);
  const filled = blanks.filter((b) => (values[b.key] ?? "") !== "").length;
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

  const typeDigit = useCallback((d) => {
    if (!focus || checked) return;
    const b = byKey[focus];
    if (!b || b.kind === "sign" || locked.has(focus)) return;
    const cur = values[focus] ?? "";
    const next = cur.length >= b.w ? d : cur + d;
    setValues((v) => ({ ...v, [focus]: next }));
    if (next.length >= b.w) { const n = nextOpen(focus); if (n) setFocus(n); }
  }, [focus, checked, byKey, locked, values, nextOpen]);
  const typeSign = useCallback((op) => {
    if (!focus || checked) return;
    const b = byKey[focus];
    if (!b || b.kind !== "sign" || locked.has(focus)) return;
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
    setValues((v) => ({ ...v, [focus]: byKey[focus]?.kind === "sign" ? "" : cur.slice(0, -1) }));
  }, [focus, checked, locked, values, nextOpen, byKey]);
  const goNext = useCallback(() => { const n = nextOpen(focus); setFocus(n ?? open[0]?.key ?? null); }, [focus, nextOpen, open]);

  useEffect(() => {
    if (checked) return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (/^[0-9]$/.test(e.key)) typeDigit(e.key);
      else if (e.key === "+") typeSign("add");
      else if (e.key === "-" || e.key === "−") typeSign("subtract");
      else if (e.key === "Backspace") erase();
      else if (e.key === "Enter" || e.key === "Tab" || e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") { const p = nextOpen(focus, -1); if (p) setFocus(p); }
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checked, typeDigit, typeSign, erase, goNext, nextOpen, focus]);

  function check() {
    const m = {};
    for (const b of blanks) m[b.key] = isAnswerRight(b.answer, values[b.key]) ? "right" : "wrong";
    setMarks(m);
    const right = Object.values(m).filter((x) => x === "right").length;
    onResult?.({ right, total: blanks.length, at: Date.now() });
    if (test.videoPrize && hasVideos && filled === blanks.length && prize === "none") setPrize("ready");
    canvasRef.current?.scrollTo?.({ top: 0, left: 0, behavior: "smooth" });
  }
  function fixErrors() {
    const keepRight = new Set(blanks.filter((b) => marks?.[b.key] === "right").map((b) => b.key));
    setLocked(keepRight);
    setValues((v) => Object.fromEntries(Object.entries(v).filter(([k]) => keepRight.has(k))));
    setMarks(null);
    setFocus(blanks.find((b) => !keepRight.has(b.key))?.key ?? null);
  }
  function restart() {
    setLocked(new Set());
    setValues({});
    setMarks(null);
    setFocus(blanks[0]?.key ?? null);
  }

  const right = marks ? Object.values(marks).filter((x) => x === "right").length : 0;
  const perBlock = useMemo(() => {
    if (!marks) return [];
    const rows = [];
    for (const p of layout.pages) for (const b of p.blocks) {
      const keys = blanks.filter((x) => x.blockId === b.block.id).map((x) => x.key);
      rows.push({ no: b.no, title: blockTitle(b.block), right: keys.filter((k) => marks[k] === "right").length, total: keys.length });
    }
    return rows;
  }, [marks, layout, blanks]);

  const childPdf = usePdfSaver();
  const sign = byKey[focus]?.kind === "sign";
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
      <b className="mt-score-num">{right} <span>из {blanks.length}</span></b>
      <span className="mt-score-sub">{right === blanks.length ? "Без ошибок!" : `Ошибок: ${blanks.length - right}`}</span>
      {prizeButton}
    </div>
  );

  return (
    <div className={`screen mt-root mt-solve${narrow ? " mt-solve--phone" : ""}${checked ? " is-checked" : ""}`} data-testid="math-tests-solve">
      <div className="screen-header mt-header">
        <button className="back-btn" onClick={onBack} aria-label="В редактор"><IconBack /></button>
        <div className="mt-solve-title">
          <b>{test.title || "Контрольная"}</b>
          {!checked && <span className="mt-progress"><span className="mt-progress-bar"><span style={{ width: `${blanks.length ? (filled / blanks.length) * 100 : 0}%` }} /></span>{narrow ? "" : "заполнено "}{filled} из {blanks.length}</span>}
          {checked && <span className="mt-progress">верно {right} из {blanks.length}</span>}
        </div>
        {!checked && <button type="button" className="mt-solve-btn" onClick={check} disabled={filled === 0}>Проверить</button>}
        {checked && !narrow && <>
          <button type="button" className="mt-ghost-btn" disabled={childPdf.job?.status === "making"} onClick={() => (childPdf.job?.status === "ready" ? childPdf.save() : childPdf.make(pdfFileName(`${test.title} — решение`), () => makeTestPdf(test, { values, marks })))}>
            {childPdf.job?.status === "making" ? "Готовлю PDF…" : childPdf.job?.status === "ready" ? "Сохранить PDF" : "PDF с решением"}
          </button>
          <button type="button" className="mt-ghost-btn" onClick={restart}>Решать заново</button>
          {right < blanks.length && <button type="button" className="mt-solve-btn" onClick={fixErrors}>Исправить ошибки</button>}
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

      {!checked && <Numpad sign={sign} onDigit={typeDigit} onSign={typeSign} onErase={erase} onNext={goNext} />}
      {checked && narrow && (
        <div className="mt-phone-actions">
          <button type="button" className="mt-ghost-btn" onClick={restart}>Заново</button>
          {right < blanks.length && <button type="button" className="mt-solve-btn" onClick={fixErrors}>Исправить ошибки</button>}
        </div>
      )}
    </div>
  );
}
