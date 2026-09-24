import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import PinGateModal from "@/shared/components/PinGateModal";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import { layoutTextIntoRows } from "./wordEngine.js";
import {
  INK_COLOR, NATIVE_L3, UNIT_H, TEXT_ROW_PITCH, TEXT_ROW_THIN_OFFSET,
  TEXT_ROW_DIAGONAL_SPACING, buildDiagonalLines,
} from "./propisRuling.js";

// Same fixed on-screen row height ReadTextView.jsx uses (no tablet 2x here -- that was a
// read_text-specific request, not part of "look like the real Тетрадный лист page").
const ROW_HEIGHT_PX = 72;

const GUIDE_ROW_LINES = [
  { y: NATIVE_L3 - TEXT_ROW_THIN_OFFSET, bold: false },
  { y: NATIVE_L3, bold: true },
];
const GUIDE_COLOR = "#6fa3e0";
const GUIDE_DIAG_W = 0.25;
const GUIDE_THIN_W = 0.4;
const GUIDE_BOLD_W = 0.9;
const FALLBACK_FONT_SIZE = 34;

// Shown once every item has been dictated. Never shown during the session itself (see
// DictationView.jsx) -- this is the FIRST point the answer appears on screen at all, since
// automatic checking is impossible here (the child writes on paper, the app never sees it).
// The adult compares this list against the notebook by eye, then (if the session has video
// reward enabled) confirms with the SAME account-wide adult PIN used everywhere else in the
// app (ParamsScreen.jsx's own session-start gate) before the reward unlocks -- not a new,
// separate PIN. Reads student/PIN straight from the global store rather than threading them
// down as new props through PropisRenderer -> DictationView -> here: every other propis view
// is already self-contained (docs/propis.md), and ParamsScreen.jsx reads adultPinHash the
// same direct way, so this isn't a new pattern.
//
// The answers render as REAL captured cursive ink on the REAL ruled/diagonal page (same
// layoutTextIntoRows/propisRuling.js primitives as ReadTextView/PrintPageView -- "Тетрадный
// лист" mode), not typed UI text on a CSS-approximated ruling -- the user's explicit call
// (2026-09-24) after an earlier CSS-only lined-background version: "именно как в режиме
// тетрадный лист, а не так как ты сделал". No tap-to-animate/Prev-Next here though -- this
// screen shows every item at once (it can run to ~40), unlike ReadTextView's one-text-at-a-
// time browsing.
export default function DictationReviewScreen({ task, onClose }) {
  const items = task?.items ?? [];
  const level = task?.level ?? "letters";

  const students = useAppStore((s) => s.students);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const adultPinHash = useAppStore((s) => s.settings.adultPinHash);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const activeStudent = students.find((s) => s.id === activeStudentId) ?? null;

  const [stage, setStage] = useState("idle"); // "idle" | "pin" | "reward"

  const handleSetPin = useCallback(async (hash) => {
    patchSettings({ adultPinHash: hash });
    const db = await getDb();
    await kv.set(db, "settings", { ...useAppStore.getState().settings, adultPinHash: hash });
    api.patch("/account/settings", { adultPinHash: hash }).catch(() => {});
  }, [patchSettings]);

  const lettersByLabel = useMemo(() => {
    const map = new Map();
    for (const item of task?.letters ?? []) map.set(item.label ?? item.id, item);
    return map;
  }, [task]);

  const connectorsByKey = useMemo(() => {
    const map = new Map();
    for (const item of task?.connectors ?? []) {
      const key = `${item.fromLine}_${item.toLine}`;
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [task]);

  const punctuationByLabel = useMemo(() => {
    const map = new Map();
    for (const item of task?.punctuation ?? []) map.set(item.label ?? item.id, item);
    return map;
  }, [task]);

  // Letters/words are dictated one at a time, but on paper they end up written in a
  // continuous flow, several per ruled line -- exactly how layoutTextIntoRows already wraps
  // any text. Each TEXT-level item is its own dictated passage though, so it gets a forced
  // line break between items (same "\n starts a fresh row" rule the constructor already
  // uses) rather than running on from the previous one.
  const combinedText = useMemo(
    () => items.map((it) => it.display).join(level === "texts" ? "\n" : " "),
    [items, level]
  );

  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(320);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWrapW(el.clientWidth || 320);
    const ro = new ResizeObserver((entries) => {
      setWrapW(entries[0].contentRect.width || 320);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rowWidthUnits = (wrapW / ROW_HEIGHT_PX) * UNIT_H;

  const layout = useMemo(
    () => layoutTextIntoRows(combinedText, lettersByLabel, connectorsByKey, rowWidthUnits, undefined, punctuationByLabel),
    [combinedText, lettersByLabel, connectorsByKey, rowWidthUnits, punctuationByLabel]
  );

  const gridHeight = (layout.rowCount - 1) * TEXT_ROW_PITCH + UNIT_H;
  const diagonalLines = useMemo(
    () => buildDiagonalLines(gridHeight, rowWidthUnits, TEXT_ROW_DIAGONAL_SPACING),
    [gridHeight, rowWidthUnits]
  );

  return (
    <div className="propis-dictation-stage">
      <button type="button" className="propis-ctrl-btn propis-dictation-close" onClick={onClose} aria-label="Закрыть">✕</button>

      <div className="propis-dictation-review">
        <div className="propis-dictation-review-header">
          <div className="propis-dictation-review-title">Диктант окончен</div>
          <p className="propis-dictation-review-hint">
            Сверьте с тетрадью — вот всё, что прозвучало, по порядку.
          </p>
        </div>

        <div className="propis-text-grid-scroll" ref={wrapRef}>
          <svg
            className="propis-text-grid-svg"
            viewBox={`0 0 ${rowWidthUnits} ${gridHeight}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="0" y="0" width="100%" height="100%" className="propis-paper" />
            {diagonalLines.map((l, i) => (
              <line key={`diag${i}`} x1={l.x1} y1={0} x2={l.x2} y2={gridHeight} stroke={GUIDE_COLOR} strokeWidth={GUIDE_DIAG_W} />
            ))}
            {Array.from({ length: layout.rowCount }, (_, rowIndex) =>
              GUIDE_ROW_LINES.map((g, gi) => (
                <line
                  key={`${rowIndex}_${gi}`}
                  x1="0" y1={rowIndex * TEXT_ROW_PITCH + g.y} x2={rowWidthUnits} y2={rowIndex * TEXT_ROW_PITCH + g.y}
                  stroke={GUIDE_COLOR}
                  strokeWidth={g.bold ? GUIDE_BOLD_W : GUIDE_THIN_W}
                />
              ))
            )}
            {layout.placed.map((p, i) => (
              <g key={i} transform={`translate(${p.x} ${p.rowIndex * TEXT_ROW_PITCH})`}>
                {p.segments.map((seg, si) =>
                  seg.type === "cursive" || seg.type === "glyph" ? (
                    <g key={si} transform={`translate(${seg.xOffset} 0)`}>
                      {(seg.type === "cursive" ? seg.trajectory.strokes : seg.strokes).map((s, ssi) => (
                        <path key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      ))}
                    </g>
                  ) : (
                    <text
                      key={si}
                      x={seg.xOffset} y={NATIVE_L3}
                      fontSize={FALLBACK_FONT_SIZE}
                      fontFamily="system-ui, sans-serif"
                      fill={INK_COLOR}
                    >
                      {seg.text}
                    </text>
                  )
                )}
              </g>
            ))}
          </svg>
        </div>

        <div className="propis-dictation-review-footer">
          {task?.videoRewardEnabled ? (
            <button type="button" className="propis-dictation-next" onClick={() => setStage("pin")}>
              ✓ Всё верно
            </button>
          ) : (
            <button type="button" className="propis-dictation-next" onClick={onClose}>
              Готово
            </button>
          )}
        </div>
      </div>

      {stage === "pin" && (
        <PinGateModal
          pinHash={adultPinHash}
          onSuccess={() => setStage("reward")}
          onSetPin={handleSetPin}
          onCancel={() => setStage("idle")}
        />
      )}

      {stage === "reward" && activeStudent && (
        <RewardVideoModal
          rewardVideos={activeStudent.rewardVideos ?? []}
          studentId={activeStudent.id}
          onDismiss={onClose}
          title="Диктант готов — молодец!"
        />
      )}
    </div>
  );
}
