import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TileGlyph } from "./Propis2Carousel";
import * as I from "./Propis2Icons";
import { useHint } from "./Propis2Hint";

// The constructor's one input: a multi-line field that grows with its text up to the room it has (then it scrolls) and
// a button with the list of the deck's elements. The system keyboard does the typing: no letter tiles.
export default function Propis2Field({ value, onChange, onCaret, disabled, singleLine, placeholder, elements, onInsertElement, caretRequest }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const { bind, tip } = useHint("Элементы");

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

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const report = () => { const el = ref.current; if (el) onCaret?.(el.selectionStart ?? 0); };
  const change = (e) => {
    let v = e.target.value;
    if (singleLine) v = v.replace(/\r?\n/g, " ");
    onChange(v, e.target.selectionStart ?? v.length);
  };

  return (
    <div className="p2-fieldwrap" ref={wrapRef}>
      <div className="p2-pick p2-elements">
        <button type="button" className={`p2-ib${open ? " is-on" : ""}`} aria-label="Элементы" aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => setOpen((o) => !o)} {...bind}>
          <I.IconElement />
          {tip}
        </button>
        {open && (
          <div className="p2-elements-panel" role="dialog" aria-label="Элементы">
            {elements.map((tile) => (
              <button key={tile.key} type="button" className="propis2-tile" data-tile={tile.text} aria-label={tile.caption} onClick={() => { setOpen(false); onInsertElement(tile.text, ref.current?.selectionStart ?? value.length); }}>
                <TileGlyph tile={tile} size={64} />
                <span className="p2-el-id" aria-hidden="true">{`{${tile.text}}`}</span>
              </button>
            ))}
          </div>
        )}
      </div>
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
