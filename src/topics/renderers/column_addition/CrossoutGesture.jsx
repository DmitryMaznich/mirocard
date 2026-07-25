// Tappable overlay marking the digit that needs crossing out during a borrow.
// Used to require a left-to-right drag spanning 70% of the cell before
// anything visible appeared — an invisible hitbox with no hint what to do,
// plus a swipe-length motor-planning demand. Now it's a highlighted, pulsing
// target (same "tap what's lit up" language as every other active cell in
// this mode) that crosses the digit out on a single tap.
export default function CrossoutGesture({ cellWidth, cellHeight, onComplete }) {
  function handleTap() {
    // A single confident diagonal stroke through the digit — there's no drag
    // path to draw anymore, so this stands in for the old hand-drawn line.
    const margin = cellWidth * 0.12;
    const path = `M ${margin.toFixed(1)},${(cellHeight - margin).toFixed(1)} L ${(cellWidth - margin).toFixed(1)},${margin.toFixed(1)}`;
    onComplete?.(path);
  }

  return (
    <button
      type="button"
      className="col-crossout-gesture"
      style={{ width: cellWidth, height: cellHeight }}
      onClick={handleTap}
      aria-label="Зачеркнуть цифру"
    />
  );
}
