import { useEffect, useRef, useState } from "react";
import { usePopupPos } from "./usePopupPos";
import { IconLetterA } from "./icons";

const FAMILY_TITLES = { straight: "Прямые линии" };
const PANEL_W = 300;

// Toolbar button that pops a letter grid under itself (propis2's
// ElementPicker/LetterPicker pattern) instead of keeping a letter grid
// permanently on screen. Picking a letter adds a new block for it.
export default function LetterPickerButton({ families, onPick }) {
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

  return (
    <div className="pl-pick" ref={wrapRef}>
      <button
        type="button"
        ref={btnRef}
        className={`pl-tool${open ? " is-open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pl-tool-ico"><IconLetterA /></span>
        <span className="pl-tool-cap">Буква</span>
      </button>
      {open && (
        <div className="pl-letters-panel" role="dialog" aria-label="Буква для нового блока" style={{ ...panelStyle, width: PANEL_W }}>
          {families.map(([famId, famLetters]) => (
            <div key={famId}>
              <div className="pl-el-group">{FAMILY_TITLES[famId] ?? famId}</div>
              <div className="pl-letters-grid">
                {famLetters.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className="pl-letters-cell"
                    onClick={() => { setOpen(false); onPick(l.id); }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
