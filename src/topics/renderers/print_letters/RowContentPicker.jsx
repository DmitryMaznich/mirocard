import { useEffect, useRef, useState } from "react";
import { usePopupPos } from "./usePopupPos";
import { IconCaret } from "./icons";

const PANEL_W = 150;

// Same button-pops-a-list pattern as the toolbar's LetterPickerButton (and
// propis2's Propis2Picker) — lives in the main toolbar now, not attached to
// the row itself, and is disabled (present, greyed out) rather than hidden
// when no row is selected, matching how propis2's own row tools behave.
export default function RowContentPicker({ value, strokeCount, onChange, disabled = false }) {
  const [openRaw, setOpen] = useState(false);
  const open = openRaw && !disabled;
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const panelStyle = usePopupPos(open, btnRef, PANEL_W, () => setOpen(false));

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const label = disabled ? "—" : value === "full" ? "Целиком" : value === "blank" ? "Пусто" : `Элемент ${Number(value) + 1}`;
  const pick = (v) => { setOpen(false); onChange(v); };

  return (
    <div className="pl-pick" ref={wrapRef}>
      <button
        type="button"
        ref={btnRef}
        className={`pl-tool${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pl-tool-ico"><IconCaret /></span>
        <span className="pl-tool-cap">{label}</span>
      </button>
      {open && (
        <div className="pl-row-pick-list" role="listbox" aria-label="Содержимое строки" style={{ ...panelStyle, width: PANEL_W }}>
          <button type="button" role="option" aria-selected={value === "full"} className={value === "full" ? "is-on" : ""} onClick={() => pick("full")}>
            Целиком
          </button>
          {Array.from({ length: strokeCount }).map((_, i) => (
            <button key={i} type="button" role="option" aria-selected={value === i} className={value === i ? "is-on" : ""} onClick={() => pick(i)}>
              Элемент {i + 1}
            </button>
          ))}
          <button type="button" role="option" aria-selected={value === "blank"} className={value === "blank" ? "is-on" : ""} onClick={() => pick("blank")}>
            Пусто
          </button>
        </div>
      )}
    </div>
  );
}
