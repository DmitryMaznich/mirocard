import { useState } from "react";
import LetterGlyph, { letterFrame } from "./LetterGlyph";
import { SIZES, LINES, GUIDES, DOTS, rowStyle, allElements, elementName, isFull, letterCells, toggleElement } from "./model";
import { IconUp, IconDown, IconLadder, IconAddRow, IconTrash } from "./icons";

const PAD_CELL = 52; // px per notebook cell in the element pad — the only element control (owner, 2026-11-03)
const INK = "#2a6b60";
const IDLE = "#b8bfc9";

// The letter drawn large on its own grid; each element is a tap target that
// toggles whether that element goes into the selected row. Any number of
// elements can be on — they keep their places inside the letter's frame.
function ElementPad({ letter, elements, onToggle }) {
  const [x, y, vw, vh] = letterFrame(letter);
  const w = letterCells(letter);
  const on = new Set(elements);
  return (
    <div className="pl-elpad" style={{ width: (w + 2) * PAD_CELL, height: 4 * PAD_CELL, backgroundSize: `${PAD_CELL}px ${PAD_CELL}px` }}>
      <svg
        viewBox={`${x} ${y} ${vw} ${vh}`}
        width={w * PAD_CELL}
        height={2 * PAD_CELL}
        style={{ position: "absolute", left: PAD_CELL, top: PAD_CELL, overflow: "visible" }}
        aria-label={`Элементы буквы ${letter.label}`}
      >
        {letter.strokes.map((s, i) => (
          <path key={`v${i}`} d={s.d} fill="none" stroke={on.has(i) ? INK : IDLE} strokeWidth={on.has(i) ? 9 : 6}
            strokeDasharray={on.has(i) ? undefined : "1 8"} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
        ))}
        {letter.strokes.map((s, i) => {
          const m = /M\s*([-\d.]+)[ ,]+([-\d.]+)/.exec(s.d);
          if (!m) return null;
          return (
            <g key={`n${i}`} pointerEvents="none">
              <circle cx={+m[1]} cy={+m[2]} r={9} fill={on.has(i) ? "#3aa655" : "#c4cad3"} />
              <text x={+m[1]} y={+m[2] + 4.2} textAnchor="middle" fontSize={12} fontWeight={800} fill="#fff">{i + 1}</text>
            </g>
          );
        })}
        {letter.strokes.map((s, i) => (
          <path
            key={`h${i}`}
            d={s.d}
            fill="none"
            stroke="transparent"
            strokeWidth={30}
            strokeLinecap="butt"
            strokeLinejoin="round"
            className="pl-elpad-hit"
            role="button"
            tabIndex={0}
            aria-pressed={on.has(i)}
            aria-label={`${i + 1}: ${elementName(letter, i)}`}
            onClick={() => onToggle(i)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(i); } }}
          />
        ))}
      </svg>
    </div>
  );
}

// The panel's top: which block / row this is, and everything done to the row itself — add one
// below, move it, delete it. These used to sit in the top tool bar; the bottom panel now owns the
// row, the top bar only the block (owner, 2026-11-03: «нелогичное разделение»).
function Head({ letter, color, title, rowActions = null }) {
  return (
    <div className="pl-insp-head">
      <div className="pl-insp-head-line">
        <span className="pl-insp-tile" style={{ "--pl-block-color": color }}>
          <LetterGlyph letter={letter} heightMm={4.2} variant="plain" color="#ffffff" weight={15} />
        </span>
        <span className="pl-insp-title">{title}</span>
      </div>
      {rowActions && (
        <div className="pl-insp-acts" role="group" aria-label="Строка">
          <button type="button" onClick={rowActions.onAdd} aria-label="Добавить строку ниже"><IconAddRow /><span>Строка</span></button>
          {rowActions.onMove && <>
            <button type="button" onClick={() => rowActions.onMove(-1)} disabled={!rowActions.canUp} aria-label="Строка выше"><IconUp /><span>Выше</span></button>
            <button type="button" onClick={() => rowActions.onMove(1)} disabled={!rowActions.canDown} aria-label="Строка ниже"><IconDown /><span>Ниже</span></button>
            <button type="button" className="is-danger" onClick={rowActions.onRemove} aria-label="Удалить строку"><IconTrash /><span>Удалить</span></button>
          </>}
        </div>
      )}
    </div>
  );
}

function LadderButton({ onLadder }) {
  const [asking, setAsking] = useState(false);
  if (asking) {
    return (
      <div className="pl-ladder-ask" role="group" aria-label="Заменить строки блока лесенкой?">
        <span>Строки блока заменятся лесенкой.</span>
        <button type="button" className="pl-ladder-yes" onClick={() => { setAsking(false); onLadder(); }}>Заменить</button>
        <button type="button" className="pl-ladder-no" onClick={() => setAsking(false)}>Отмена</button>
      </div>
    );
  }
  return (
    <button type="button" className="pl-ladder" onClick={() => setAsking(true)}>
      <IconLadder /> Лесенка: собрать букву по шагам
    </button>
  );
}

// Block-wide size switch: normal (2 cells) or large (4 cells).
const FIXED_SIZE_HINT = {
  bigcell: "На крупной клетке одна буква — одна клетка (1 см), как в пособии. Крупный размер — на обычной клетке.",
  line: "На линейке размер задаёт линейка: буква стоит на строке и доходит до пунктира. Крупный размер — на обычной клетке.",
};

function SizeSwitch({ size, onSetSize, paper }) {
  if (!onSetSize) return null;
  if (FIXED_SIZE_HINT[paper]) return <span className="pl-insp-hint">{FIXED_SIZE_HINT[paper]}</span>;
  return (
    <>
      <div className="pl-seg" role="radiogroup" aria-label="Размер букв в блоке">
        {SIZES.map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={size === s.id} title={s.hint}
            className={size === s.id ? "is-on" : ""} onClick={() => onSetSize(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <span className="pl-insp-hint">{SIZES.find((s) => s.id === size)?.hint}</span>
    </>
  );
}

// One option of the row as a segmented switch.
function Seg({ label, options, value, disabled, onChange }) {
  return (
    <div className="pl-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} disabled={disabled}
          className={value === o.id ? "is-on" : ""} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// The selected row's own settings — a right-hand panel on a computer, the
// docked panel at the bottom on a phone. Elements are picked only on the big
// letter (ElementPad) — no duplicate list beside it (owner, 2026-11-03).
export default function RowInspector({ letter, color, row, rowIndex, rowCount, size = 2, paper = "cell", onSetSize, onSetElements, onSetStyle, onMoveRow, onAddRow, onRemoveRow, onLadder }) {
  if (!letter) {
    return (
      <div className="pl-insp pl-insp--empty">
        <p>Нажмите на строку на листе — здесь появятся её элементы и опора.</p>
        <p>Новый блок — кнопка «Буква» на панели.</p>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="pl-insp">
        <Head letter={letter} color={color} title={`Буква ${letter.label}`} rowActions={{ onAdd: onAddRow }} />
        <p className="pl-insp-hint">Выберите строку в блоке, чтобы настроить её элементы и опору.</p>
        <SizeSwitch size={size} onSetSize={onSetSize} paper={paper} />
        <LadderButton onLadder={onLadder} />
      </div>
    );
  }

  const elements = row.elements;
  const blank = elements.length === 0;
  const full = isFull(letter, elements);
  const toggle = (i) => onSetElements(toggleElement(elements, i));
  const st = rowStyle(row);

  return (
    <div className="pl-insp">
      <Head letter={letter} color={color} title={`Строка ${rowIndex + 1} из ${rowCount}`}
        rowActions={{ onAdd: onAddRow, onMove: onMoveRow, onRemove: onRemoveRow, canUp: rowIndex > 0, canDown: rowIndex < rowCount - 1 }} />

      <section className="pl-insp-sec" aria-label="Элементы">
        <span className="pl-insp-lbl">Элементы — нажмите на штрих буквы</span>
        <div className="pl-insp-els">
          <ElementPad letter={letter} elements={elements} onToggle={toggle} />
        </div>
        <div className="pl-insp-row">
          <button type="button" className={`pl-el pl-el--grow${full ? " is-on" : ""}`} onClick={() => onSetElements(allElements(letter))}>Вся буква</button>
          <button type="button" className={`pl-el pl-el--grow${blank ? " is-on" : ""}`} onClick={() => onSetElements([])}>Пустая строка</button>
        </div>
      </section>

      <section className="pl-insp-sec" aria-label="Линия">
        <span className="pl-insp-lbl">Линия контура</span>
        <Seg label="Линия контура" options={LINES} value={st.line} disabled={blank || st.guide === "none"} onChange={(line) => onSetStyle({ line })} />
      </section>

      <section className="pl-insp-sec" aria-label="Контуры">
        <span className="pl-insp-lbl">Контуры после образца</span>
        <Seg label="Контуры после образца" options={GUIDES} value={st.guide} disabled={blank} onChange={(guide) => onSetStyle({ guide })} />
      </section>

      <section className="pl-insp-sec" aria-label="Точки">
        <span className="pl-insp-lbl">Точки начала штрихов</span>
        <Seg label="Точки начала штрихов" options={DOTS} value={st.dots} disabled={blank} onChange={(dots) => onSetStyle({ dots })} />
        {blank && <span className="pl-insp-hint">Пустая строка — ребёнок пишет сам.</span>}
      </section>

      <section className="pl-insp-sec pl-insp-sec--block" aria-label="Весь блок">
        <span className="pl-insp-lbl">Весь блок</span>
        <SizeSwitch size={size} onSetSize={onSetSize} paper={paper} />
        <LadderButton onLadder={onLadder} />
        <span className="pl-insp-hint">1 → 1+2 → … → вся буква → затухают → только образец → пусто. Потом любую строку можно поменять.</span>
      </section>
    </div>
  );
}
