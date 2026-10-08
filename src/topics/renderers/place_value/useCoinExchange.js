import { useLayoutEffect, useRef, useState } from "react";

const center = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width };
};
const coin = (board, id) => board.querySelector(`[data-coin-id="${id}"] .cb-coin`);
const layers = (board, id) => Array.from(board.querySelectorAll(`[data-stack-id="${id}"] .cb-stack-coin`));

// Preserve the staggered ten-for-one flight in both modes. Real layer positions
// replace the old hardcoded stack pitch; ghosts inherit the actual coin size.
export function useCoinExchange(boardRef) {
  const [flight, setFlight] = useState(null);
  const lock = useRef(false);
  const start = ({ direction, stackId, coinIds, commit }) => {
    if (lock.current || !boardRef.current) return false;
    const origins = direction === "group" ? coinIds.map((id) => coin(boardRef.current, id)) : layers(boardRef.current, stackId).reverse();
    if (origins.length !== 10 || origins.some((el) => !el)) return false;
    lock.current = true;
    const from = origins.map(center);
    commit();
    setFlight({ direction, stackId, coinIds, from });
    return true;
  };
  useLayoutEffect(() => {
    if (!flight) return;
    let cancelled = false;
    const ghosts = [], animations = [];
    const finish = () => { if (!cancelled) { lock.current = false; setFlight(null); } };
    const frame = requestAnimationFrame(() => {
      const board = boardRef.current;
      if (!board) { finish(); return; }
      const destinations = flight.direction === "group" ? layers(board, flight.stackId) : flight.coinIds.map((id) => coin(board, id));
      if (destinations.length !== 10 || destinations.some((el) => !el) || typeof Element.prototype.animate !== "function"
        || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { finish(); return; }
      let remaining = 10;
      destinations.forEach((el, i) => {
        const from = flight.from[i], to = center(el);
        const ghost = document.createElement("div");
        ghost.className = "cb-coin cb-coin-fly-ghost";
        ghost.style.cssText = `left:${from.x}px;top:${from.y}px;width:${to.width || from.width}px;height:${to.width || from.width}px`;
        document.body.appendChild(ghost);
        ghosts.push(ghost);
        const anim = ghost.animate([
          { transform: "translate(-50%, -50%)" },
          { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px))` },
        ], { duration: 300, delay: i * 45, easing: "cubic-bezier(.35,.6,.4,1)", fill: "forwards" });
        animations.push(anim);
        anim.onfinish = () => { ghost.remove(); if (--remaining === 0) finish(); };
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); animations.forEach((anim) => anim.cancel()); ghosts.forEach((ghost) => ghost.remove()); };
  }, [flight, boardRef]);
  return { start, busy: flight !== null, pendingStack: flight?.direction === "group" ? flight.stackId : null,
    pendingCoins: flight?.direction === "ungroup" ? flight.coinIds : [] };
}
