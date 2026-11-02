import { useRef } from "react";

// Phone layout of the row panel: a sheet pinned to the bottom edge. Folded
// it shows only the row header and quick element buttons, so the page stays
// visible; raised it shows the whole panel. Tap the handle or swipe it.
// Pinned to the bottom (and the sides) of the screen, so it reserves the iOS
// safe areas — see print_letters.css .pl-bsheet.
export default function BottomSheet({ expanded, onExpandedChange, children }) {
  const startY = useRef(null);
  const moved = useRef(false);

  function down(e) {
    startY.current = e.clientY;
    moved.current = false;
  }
  function up(e) {
    if (startY.current == null) return;
    const dy = e.clientY - startY.current;
    startY.current = null;
    if (dy < -24) { moved.current = true; onExpandedChange(true); }
    else if (dy > 24) { moved.current = true; onExpandedChange(false); }
  }
  function click() {
    if (moved.current) { moved.current = false; return; }
    onExpandedChange(!expanded);
  }

  return (
    <div className={`pl-bsheet no-print${expanded ? " is-expanded" : ""}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="pl-bsheet-handle"
        aria-expanded={expanded}
        aria-label={expanded ? "Свернуть панель строки" : "Развернуть панель строки"}
        onPointerDown={down}
        onPointerUp={up}
        onClick={click}
      >
        <span aria-hidden="true" />
      </button>
      <div className="pl-bsheet-body">{children}</div>
    </div>
  );
}
