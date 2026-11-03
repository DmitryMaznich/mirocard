import { useState } from "react";
import LetterGlyph, { letterFrame } from "./LetterGlyph";
import { SIZES, LINES, GUIDES, DOTS, rowStyle, describeStyle, allElements, elementName, isFull, letterCells, toggleElement } from "./model";
import OptionPicker from "./OptionPicker";
import { PlateWords } from "./WordBlock";
import { allLetterIdx, plateWords } from "./words";
import {
  IconUp, IconDown, IconLadder, IconAddRow, IconTrash,
  IconLineTone, IconLineDash, IconGuideFull, IconGuideFade, IconGuideNone, IconDotsSample, IconDotsAll, IconDotsNone, IconArrows,
} from "./icons";

const LINE_ICONS = { tone: IconLineTone, dash: IconLineDash };
const GUIDE_ICONS = { full: IconGuideFull, fade: IconGuideFade, none: IconGuideNone };
const DOT_ICONS = { sample: IconDotsSample, all: IconDotsAll, none: IconDotsNone };
const withIcons = (list, icons) => list.map((o) => ({ ...o, Icon: icons[o.id] }));

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
      {/* dots, arrows and numbers exactly as on the sheet's sample: the same LetterGlyph, its own
          strokes transparent (the pad draws on/off strokes itself), under no taps */}
      <div style={{ position: "absolute", left: PAD_CELL, top: PAD_CELL, pointerEvents: "none" }} aria-hidden="true">
        <LetterGlyph letter={{ ...letter, strokes: letter.strokes.map((st, i) => ({ ...st, n: i + 1 })) }} frame={letterFrame(letter)}
          heightMm={(2 * PAD_CELL * 25.4) / 96} widthMm={(w * PAD_CELL * 25.4) / 96} variant="sample" color="transparent" />
      </div>
    </div>
  );
}

// The panel's top: which block / row this is, and everything done to the row itself — add one
// below, move it, delete it. These used to sit in the top tool bar; the bottom panel now owns the
// row, the top bar only the block (owner, 2026-11-03: «нелогичное разделение»).
function Head({ letter, tile = null, color, title, rowActions = null }) {
  return (
    <div className="pl-insp-head">
      <div className="pl-insp-head-line">
        <span className={`pl-insp-tile${tile ? " pl-insp-tile--word" : ""}`} style={{ "--pl-block-color": color }}>
          {tile ?? <LetterGlyph letter={letter} heightMm={4.2} variant="plain" color="#ffffff" weight={15} />}
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

function LadderButton({ onLadder, word = false }) {
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
      <IconLadder /> {word ? "Лесенка: от образца к самостоятельному письму" : "Лесенка: собрать букву по шагам"}
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

// The row's look: three pickers like the strips above (propis2's icon + drop-down list).
function LookPickers({ row, blank, onSetStyle }) {
  const st = rowStyle(row);
  return (
    <section className="pl-insp-sec" aria-label="Как выглядят контуры">
      <span className="pl-insp-lbl">Контуры</span>
      <div className="pl-insp-picks" role="group" aria-label="Как выглядят контуры">
        <OptionPicker label="Линия контура" caption="Линия" options={withIcons(LINES, LINE_ICONS)} value={st.line} disabled={blank || st.guide === "none"} onChange={(line) => onSetStyle({ line })} />
        <OptionPicker label="Контуры после образца" caption="Контуры" options={withIcons(GUIDES, GUIDE_ICONS)} value={st.guide} disabled={blank} onChange={(guide) => onSetStyle({ guide })} />
        <OptionPicker label="Точки начала штрихов" caption="Точки" options={withIcons(DOTS, DOT_ICONS)} value={st.dots} disabled={blank} onChange={(dots) => onSetStyle({ dots })} />
        <div className="pl2-pick">
          <button type="button" className={`pl2-pick-btn pl2-tool pl-toggle${st.arrows ? " is-on" : ""}`} role="switch" aria-checked={st.arrows}
            aria-label={`Стрелки направления на образце: ${st.arrows ? "включены" : "выключены"}`} title={st.arrows ? "Стрелки на образце: вкл" : "Стрелки на образце: выкл"}
            disabled={blank} onClick={() => onSetStyle({ arrows: !st.arrows })}>
            <span className="pl2-tool-ico"><IconArrows /></span>
            <span className="pl2-cap">Стрелки</span>
          </button>
        </div>
      </div>
      <span className="pl-insp-hint">{blank ? "Пустая строка — ребёнок пишет сам." : describeStyle(row)}</span>
    </section>
  );
}

function BlockSection({ size, onSetSize, paper, onLadder, word }) {
  return (
    <section className="pl-insp-sec pl-insp-sec--block" aria-label="Весь блок">
      <span className="pl-insp-lbl">Весь блок</span>
      <SizeSwitch size={size} onSetSize={onSetSize} paper={paper} />
      <LadderButton onLadder={onLadder} word={word} />
      <span className="pl-insp-hint">{word
        ? "Слово по пунктиру → пропущена гласная → затухает → только образец → пусто."
        : "1 → 1+2 → … → вся буква → затухают → только образец → пусто. Потом любую строку можно поменять."}</span>
    </section>
  );
}

// The word drawn large: each letter a tile; tapping one leaves it out of the contours after the
// sample (its letter-cell stays blank — «впиши пропущенную»). The sample keeps the whole word.
function WordPad({ text, byId, elements, onToggle }) {
  const on = new Set(elements);
  return (
    <div className="pl-wordpad">
      {[...text].map((ch, i) => {
        const letter = byId[ch];
        if (!letter) return null;
        return (
          <button key={i} type="button" className={`pl-wordpad-l${on.has(i) ? " is-on" : ""}`} aria-pressed={on.has(i)}
            aria-label={`${ch}: ${on.has(i) ? "в контурах" : "пропущена"}`} onClick={() => onToggle(i)}>
            <LetterGlyph letter={letter} heightMm={11} variant="plain" color={on.has(i) ? "#1f3a8a" : "#b8c0cc"} weight={10} />
          </button>
        );
      })}
    </div>
  );
}

// A syllable / word block's row (words.js): which word, which letters stay on the contours, the
// look — and the block's size and ladder.
function WordInspector({ block, byId, color, row, rowIndex, rowCount, size, paper, onSetSize, onSetElements, onSetText, onSetStyle, onMoveRow, onAddRow, onRemoveRow, onLadder }) {
  const tile = <PlateWords words={plateWords(block)} byId={byId} heightMm={4.2} />;
  const label = block.words.join(" ");
  if (!row) {
    return (
      <div className="pl-insp">
        <Head tile={tile} color={color} title={label} rowActions={{ onAdd: onAddRow }} />
        <p className="pl-insp-hint">Выберите строку в блоке, чтобы настроить её буквы и контуры.</p>
        <BlockSection size={size} onSetSize={onSetSize} paper={paper} onLadder={onLadder} word />
      </div>
    );
  }
  const text = row.text ?? block.words[0];
  const elements = row.elements;
  const blank = elements.length === 0;
  const all = allLetterIdx(text);
  const toggle = (i) => onSetElements(toggleElement(elements, i));
  return (
    <div className="pl-insp">
      <Head tile={tile} color={color} title={`Строка ${rowIndex + 1} из ${rowCount}`}
        rowActions={{ onAdd: onAddRow, onMove: onMoveRow, onRemove: onRemoveRow, canUp: rowIndex > 0, canDown: rowIndex < rowCount - 1 }} />

      {block.words.length > 1 && (
        <section className="pl-insp-sec" aria-label="Что пишем в строке">
          <span className="pl-insp-lbl">Что пишем</span>
          <div className="pl-seg" role="radiogroup" aria-label="Слог или слово строки">
            {block.words.map((w) => (
              <button key={w} type="button" role="radio" aria-checked={text === w} className={text === w ? "is-on" : ""} onClick={() => onSetText(w)}>{w}</button>
            ))}
          </div>
        </section>
      )}

      <section className="pl-insp-sec" aria-label="Буквы">
        <span className="pl-insp-lbl">Буквы — нажмите, чтобы пропустить</span>
        <WordPad text={text} byId={byId} elements={elements} onToggle={toggle} />
        <div className="pl-insp-row">
          <button type="button" className={`pl-el pl-el--grow${elements.length === all.length ? " is-on" : ""}`} onClick={() => onSetElements(all)}>{text.length > 2 ? "Всё слово" : "Весь слог"}</button>
          <button type="button" className={`pl-el pl-el--grow${blank ? " is-on" : ""}`} onClick={() => onSetElements([])}>Пустая строка</button>
        </div>
      </section>

      <LookPickers row={row} blank={blank} onSetStyle={onSetStyle} />
      <BlockSection size={size} onSetSize={onSetSize} paper={paper} onLadder={onLadder} word />
    </div>
  );
}

// The selected row's own settings — a right-hand panel on a computer, the
// docked panel at the bottom on a phone. Elements are picked only on the big
// letter (ElementPad) — no duplicate list beside it (owner, 2026-11-03).
export default function RowInspector(props) {
  const { letter, wordBlock, color, row, rowIndex, rowCount, size = 2, paper = "cell", onSetSize, onSetElements, onSetStyle, onMoveRow, onAddRow, onRemoveRow, onLadder } = props;
  if (wordBlock) return <WordInspector {...props} block={wordBlock} size={size} paper={paper} />;
  if (!letter) {
    return (
      <div className="pl-insp pl-insp--empty">
        <p>Нажмите на строку на листе — здесь появятся её элементы и опора.</p>
        <p>Новый блок — кнопка «Блок» на панели: буква, слог или слово.</p>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="pl-insp">
        <Head letter={letter} color={color} title={`Буква ${letter.label}`} rowActions={{ onAdd: onAddRow }} />
        <p className="pl-insp-hint">Выберите строку в блоке, чтобы настроить её элементы и опору.</p>
        <BlockSection size={size} onSetSize={onSetSize} paper={paper} onLadder={onLadder} word={false} />
      </div>
    );
  }

  const elements = row.elements;
  const blank = elements.length === 0;
  const full = isFull(letter, elements);
  const toggle = (i) => onSetElements(toggleElement(elements, i));

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

      <LookPickers row={row} blank={blank} onSetStyle={onSetStyle} />

      <BlockSection size={size} onSetSize={onSetSize} paper={paper} onLadder={onLadder} word={false} />
    </div>
  );
}
