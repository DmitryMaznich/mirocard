import { useEffect, useRef, useState } from "react";
import { usePopupPos } from "./usePopupPos";

const PANEL_W = 190;
const OPTION_H = 46; // a list entry's height, to open the list above the button when it doesn't fit below

// A setting picked from a short list — propis2's own toolbar picker pattern
// (Propis2Picker: a button that pops a list under itself). Used for the
// page (format, paper) and for the row's look (line, contours, dots) in the
// row panel, where the list opens upward when the button is low on screen.
export default function OptionPicker({ options, value, onChange, label, caption, disabled = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const panelStyle = usePopupPos(open, btnRef, PANEL_W, () => setOpen(false), options.length * OPTION_H + 12);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const current = options.find((o) => o.id === value) ?? options[0];
  const pick = (id) => { setOpen(false); onChange(id); };

  return (
    <div className="pl2-pick" ref={wrapRef}>
      <button
        type="button"
        ref={btnRef}
        className={`pl2-pick-btn pl2-tool${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current.label}`}
        title={`${label}: ${current.label}`}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pl2-tool-ico"><current.Icon /><svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></span>
        <span className="pl2-cap">{caption ?? current.label}</span>
      </button>
      {open && (
        <div className="pl-row-pick-list" role="listbox" aria-label={label} style={{ ...panelStyle, width: PANEL_W }}>
          {options.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={value === id}
              className={`pl-paper-opt${value === id ? " is-on" : ""}`}
              onClick={() => pick(id)}
            >
              <span className="pl-tool-ico"><Icon /></span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
