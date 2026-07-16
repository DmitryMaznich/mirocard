// Fixed heap layout (not randomized per render) so the pile's silhouette
// stays recognizable across reloads — a 5/4/3/2/1 triangular stack (15
// coins total), each row nested in the gaps of the row below it, like a
// real coin pyramid. Every position here is individually draggable in
// BuildNumberTask.jsx (its own useDraggable, not just the apex), so a
// child can pull any coin out of the pile, not only the top one — the
// "top" flag marks only the apex coin for the idle "pick me" bob hint.
export const PILE_LAYOUT = [
  // row 0 (bottom, 5)
  { x: 2, y: 58, r: -8 },
  { x: 26, y: 58, r: 6 },
  { x: 50, y: 58, r: -4 },
  { x: 74, y: 58, r: 10 },
  { x: 98, y: 58, r: -6 },
  // row 1 (4)
  { x: 14, y: 44, r: 5 },
  { x: 38, y: 44, r: -9 },
  { x: 62, y: 44, r: 4 },
  { x: 86, y: 44, r: -5 },
  // row 2 (3)
  { x: 26, y: 30, r: -7 },
  { x: 50, y: 30, r: 3 },
  { x: 74, y: 30, r: -10 },
  // row 3 (2)
  { x: 38, y: 16, r: 6 },
  { x: 62, y: 16, r: -4 },
  // row 4 (apex, 1)
  { x: 50, y: 2, r: 3, top: true },
];

export function Coin({ numeric = false, groupable = false }) {
  return (
    <div className={`cb-coin${groupable ? " cb-coin--groupable" : ""}`}>
      {numeric ? "1" : null}
    </div>
  );
}

export function TenStack({ numeric = false }) {
  return (
    <div className="cb-ten-stack">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="cb-stack-coin" />
      ))}
      {numeric && <div className="cb-stack-badge">10</div>}
    </div>
  );
}
