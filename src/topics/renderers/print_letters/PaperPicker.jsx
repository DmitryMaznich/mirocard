import { useEffect, useRef, useState } from "react";
import { usePopupPos } from "./usePopupPos";
import { IconPaperSquare, IconPaperRuled } from "./icons";

const PANEL_W = 170;
const OPTIONS = [
  { id: "cell", label: "Клетка", Icon: IconPaperSquare },
  { id: "line", label: "Линейка", Icon: IconPaperRuled },
];

// Page-level background choice, same button-pops-a-list pattern as the other
// toolbar pickers — propis2's own "Тип бумаги" (Propis2Editor.jsx). Клетка
// snaps a letter to both the grid's horizontal AND vertical lines (its 2×2
// cell box sits flush inside one grid square); линейка drops the vertical
// lines and anchors only the letter's own baseline — the bottom edge of
// that same box — to one of the remaining horizontal lines.
export default function PaperPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
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

  const current = OPTIONS.find((o) => o.id === value) ?? OPTIONS[0];
  const pick = (id) => { setOpen(false); onChange(id); };

  return (
    <div className="pl-pick" ref={wrapRef}>
      <button
        type="button"
        ref={btnRef}
        className={`pl-tool${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pl-tool-ico"><current.Icon /></span>
        <span className="pl-tool-cap">{current.label}</span>
      </button>
      {open && (
        <div className="pl-row-pick-list" role="listbox" aria-label="Подложка страницы" style={{ ...panelStyle, width: PANEL_W }}>
          {OPTIONS.map(({ id, label, Icon }) => (
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
