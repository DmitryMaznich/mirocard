import { useState } from "react";
import LetterGlyph, { letterFrame } from "./LetterGlyph";
import { SIZES, SUPPORTS, allElements, elementName, isFull, letterCells, toggleElement } from "./model";
import { IconUp, IconDown, IconLadder } from "./icons";

const PAD_CELL = 40; // px per notebook cell in the element pad
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
        {letter.strokes.map((s, i) => (
          <path
            key={`h${i}`}
            d={s.d}
            fill="none"
            stroke="transparent"
            strokeWidth={30}
            strokeLinecap="round"
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

// Tiny picture of one element inside the whole letter, for list buttons.
function ElementIcon({ letter, index }) {
  const [x, y, vw, vh] = letterFrame(letter);
  return (
    <svg viewBox={`${x - 8} ${y - 8} ${vw + 16} ${vh + 16}`} height={22} width={22 * (vw + 16) / (vh + 16)} aria-hidden="true" style={{ overflow: "visible", flexShrink: 0 }}>
      {letter.strokes.map((s, i) => (
        <path key={i} d={s.d} fill="none" stroke={i === index ? "currentColor" : "#cfd4db"} strokeWidth={i === index ? 14 : 8} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

function Head({ letter, color, title, onMoveRow, canUp, canDown }) {
  return (
    <div className="pl-insp-head">
      <span className="pl-insp-tile" style={{ "--pl-block-color": color }}>
        <LetterGlyph letter={letter} heightMm={4.2} variant="plain" color="#ffffff" weight={15} />
      </span>
      <span className="pl-insp-title">{title}</span>
      {onMoveRow && (
        <span className="pl-insp-move">
          <button type="button" onClick={() => onMoveRow(-1)} disabled={!canUp} aria-label="Строка выше" title="Выше"><IconUp /></button>
          <button type="button" onClick={() => onMoveRow(1)} disabled={!canDown} aria-label="Строка ниже" title="Ниже"><IconDown /></button>
        </span>
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

// The selected row's own settings — a right-hand panel on wide screens, a
// bottom sheet on phones (BottomSheet). `peek` is the sheet's folded state:
// just the header and quick element buttons.
// Block-wide size switch: normal (2 cells) or large (4 cells).
function SizeSwitch({ size, onSetSize }) {
  if (!onSetSize) return null;
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

export default function RowInspector({ letter, color, row, rowIndex, rowCount, size = 2, onSetSize, onSetElements, onSetSupport, onMoveRow, onLadder, peek = false }) {
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
        <Head letter={letter} color={color} title={`Буква ${letter.label}`} />
        {!peek && <p className="pl-insp-hint">Выберите строку в блоке, чтобы настроить её элементы и опору.</p>}
        {!peek && <SizeSwitch size={size} onSetSize={onSetSize} />}
        <LadderButton onLadder={onLadder} />
      </div>
    );
  }

  const elements = row.elements;
  const blank = elements.length === 0;
  const full = isFull(letter, elements);
  const toggle = (i) => onSetElements(toggleElement(elements, i));

  return (
    <div className={`pl-insp${peek ? " pl-insp--peek" : ""}`}>
      <Head letter={letter} color={color} title={`Строка ${rowIndex + 1} из ${rowCount}`} onMoveRow={peek ? null : onMoveRow} canUp={rowIndex > 0} canDown={rowIndex < rowCount - 1} />

      {peek ? (
        <div className="pl-insp-pills">
          {letter.strokes.map((_, i) => (
            <button key={i} type="button" className={`pl-el${elements.includes(i) ? " is-on" : ""}`} aria-pressed={elements.includes(i)} aria-label={`${i + 1}: ${elementName(letter, i)}`} onClick={() => toggle(i)}>
              <ElementIcon letter={letter} index={i} />{i + 1}
            </button>
          ))}
          <button type="button" className={`pl-el${full ? " is-on" : ""}`} onClick={() => onSetElements(allElements(letter))}>Вся</button>
          <button type="button" className={`pl-el${blank ? " is-on" : ""}`} onClick={() => onSetElements([])}>Пусто</button>
        </div>
      ) : (
        <>
          <section className="pl-insp-sec" aria-label="Элементы">
            <span className="pl-insp-lbl">Элементы — нажмите на букве</span>
            <div className="pl-insp-els">
              <ElementPad letter={letter} elements={elements} onToggle={toggle} />
              <div className="pl-insp-list">
                {letter.strokes.map((_, i) => (
                  <button key={i} type="button" className={`pl-el pl-el--wide${elements.includes(i) ? " is-on" : ""}`} aria-pressed={elements.includes(i)} onClick={() => toggle(i)}>
                    <ElementIcon letter={letter} index={i} />
                    <span>{i + 1} · {elementName(letter, i)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="pl-insp-row">
              <button type="button" className={`pl-el pl-el--grow${full ? " is-on" : ""}`} onClick={() => onSetElements(allElements(letter))}>Вся буква</button>
              <button type="button" className={`pl-el pl-el--grow${blank ? " is-on" : ""}`} onClick={() => onSetElements([])}>Пустая строка</button>
            </div>
          </section>

          <section className="pl-insp-sec" aria-label="Опора">
            <span className="pl-insp-lbl">Опора</span>
            <div className="pl-seg" role="radiogroup" aria-label="Опора в строке">
              {SUPPORTS.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={row.support === s.id} disabled={blank} title={s.hint}
                  className={row.support === s.id ? "is-on" : ""} onClick={() => onSetSupport(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
            <span className="pl-insp-hint">{blank ? "Пустая строка — ребёнок пишет сам." : SUPPORTS.find((s) => s.id === row.support)?.hint}</span>
          </section>

          <section className="pl-insp-sec pl-insp-sec--block" aria-label="Весь блок">
            <span className="pl-insp-lbl">Весь блок</span>
            <SizeSwitch size={size} onSetSize={onSetSize} />
            <LadderButton onLadder={onLadder} />
            <span className="pl-insp-hint">1 → 1+2 → … → вся буква → бледнеет → образец → пусто. Потом любую строку можно поменять.</span>
          </section>
        </>
      )}
    </div>
  );
}
