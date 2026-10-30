import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { TileGlyph } from "./Propis2Carousel";
import * as I from "./Propis2Icons";
import { useHint } from "./Propis2Hint";
import { usePopupPos } from "./usePopupPos";

// The constructor's one input: a multi-line field that grows with its text up to the room it has (then it scrolls) and
// a button with the list of the deck's elements. The system keyboard does the typing: no letter tiles.
// The button «Элемент» with the list of the deck's elements (each tile is the element on the page's own ruling: wide row, narrow row, slant). Shared by the compact
// field (phone) and the full-page text editor (wide screens).
const ELEMENT_TILE_W = 84; // px: the ruling inside is drawn at this width, so the slant and the rows read at a glance

export function ElementPicker({ elements, disabled, onInsert }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  // fixed to the screen under the button (usePopupPos): the button lives in the row's tool strip, which clips what sticks out of it
  const panelStyle = usePopupPos(open, btnRef, 520, () => setOpen(false));
  const { bind, tip } = useHint("Элементы");
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="p2-pick p2-elements" ref={wrapRef}>
      <button type="button" ref={btnRef} className={`p2-ib p2-tool${open ? " is-on" : ""}`} aria-label="Элементы" aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => setOpen((o) => !o)} {...bind}>
        <span className="p2-tool-ico"><I.IconElement /></span>
        <span className="p2-cap">Элемент</span>
        {tip}
      </button>
      {open && (
        <div className="p2-elements-panel" role="dialog" aria-label="Элементы" style={panelStyle ? { ...panelStyle, bottom: "auto", right: "auto" } : undefined}>
          {elements.map((tile, i) => (
            <Fragment key={tile.key}>
              {tile.group && tile.group !== elements[i - 1]?.group && <div className="p2-el-group" role="presentation">{tile.group}</div>}
              <button type="button" className="propis2-tile" data-tile={tile.text} aria-label={`№${tile.no}, ${tile.caption}`} title={`№${tile.no} · ${tile.caption}`} onClick={() => { setOpen(false); onInsert(`{${tile.code}}`); }}>
                <TileGlyph tile={tile} size={ELEMENT_TILE_W} />
                <span className="p2-el-num" aria-hidden="true">{tile.no}</span>
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Propis2Field({ value, onChange, onCaret, disabled, singleLine, placeholder, elements, onInsertElement, caretRequest }) {
  const ref = useRef(null);
  const wrapRef = useRef(null);
  const [focused, setFocused] = useState(false);
  // while typing the field grows with its text (CSS max-height stops it and it scrolls); when not in use it folds to one line
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    if (focused) { el.style.height = `${el.scrollHeight}px`; return; }
    const cs = window.getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || 26;
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    el.style.height = `${Math.min(el.scrollHeight, Math.ceil(line + pad))}px`;
    el.scrollTop = 0;
  }, [value, focused]);

  // a tap anywhere outside the field (a row on the page, a tool) puts it away: blur, so it folds even where the browser keeps focus
  useEffect(() => {
    if (!focused) return undefined;
    const away = (e) => { if (!wrapRef.current?.contains(e.target)) ref.current?.blur(); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [focused]);

  // put the caret where the parent asks (after an element was inserted) and keep typing there
  useEffect(() => {
    const el = ref.current;
    if (!el || !caretRequest) return;
    el.focus();
    el.setSelectionRange(caretRequest.pos, caretRequest.pos);
  }, [caretRequest]);

  const report = () => { const el = ref.current; if (el) onCaret?.(el.selectionStart ?? 0); };
  const change = (e) => {
    let v = e.target.value;
    if (singleLine) v = v.replace(/\r?\n/g, " ");
    onChange(v, e.target.selectionStart ?? v.length);
  };

  return (
    <div className="p2-fieldwrap" ref={wrapRef}>
      <ElementPicker elements={elements} disabled={disabled} onInsert={(text) => onInsertElement(text, ref.current?.selectionStart ?? value.length)} />
      <textarea
        ref={ref}
        className="p2-textarea"
        rows={1}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Текст страницы"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint={singleLine ? "done" : "enter"}
        onChange={change}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => { if (singleLine && e.key === "Enter") e.preventDefault(); }}
        onSelect={report}
        onKeyUp={report}
        onClick={report}
      />
    </div>
  );
}
