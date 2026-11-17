import { useCallback, useEffect, useRef, useState } from "react";

// Pointer drag for letter cards and the chip. A press that barely moves is a
// tap (onTap); a drag ends over an element with data-drop="<id>" (onDrop).
// The ghost follows the finger; the original stays in place, dimmed.
export function useDrag({ onDrop, onTap }) {
  const [ghost, setGhost] = useState(null); // { x, y, payload }
  const state = useRef(null);
  const handlers = useRef({ onDrop, onTap });
  handlers.current = { onDrop, onTap };

  useEffect(() => {
    function move(event) {
      const s = state.current;
      if (!s) return;
      const dx = event.clientX - s.x0;
      const dy = event.clientY - s.y0;
      if (!s.moved && Math.hypot(dx, dy) < 8) return;
      s.moved = true;
      setGhost({ x: event.clientX, y: event.clientY, payload: s.payload });
    }
    function up(event) {
      const s = state.current;
      if (!s) return;
      state.current = null;
      setGhost(null);
      if (!s.moved) { handlers.current.onTap?.(s.payload); return; }
      // elementsFromPoint, not elementFromPoint: the ghost under the finger must not hide the target.
      const target = document.elementsFromPoint(event.clientX, event.clientY)
        .map((el) => el.closest?.("[data-drop]")).find(Boolean);
      if (target) handlers.current.onDrop?.(s.payload, target.getAttribute("data-drop"));
    }
    function cancel() { state.current = null; setGhost(null); }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, []);

  const start = useCallback((event, payload) => {
    event.preventDefault();
    event.stopPropagation();
    state.current = { x0: event.clientX, y0: event.clientY, payload, moved: false };
  }, []);

  return { start, ghost, dragging: ghost?.payload ?? null };
}
