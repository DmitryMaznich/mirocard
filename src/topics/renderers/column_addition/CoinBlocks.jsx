// Fixed heap layout (not randomized per render) so the pile's silhouette
// stays recognizable across reloads — wide base narrowing toward the apex,
// where the separately-rendered, actually-draggable top coin (PILE_TOP,
// below) sits. Keeping the drag target as a single coin — not this whole
// heap — is what makes dragging pull one coin away while the rest of the
// pile stays put.
const PILE_LAYOUT = [
  { x: 4, y: 40, r: -8 },
  { x: 30, y: 44, r: 6 },
  { x: 56, y: 42, r: -4 },
  { x: 82, y: 40, r: 10 },
  { x: 18, y: 24, r: -10 },
  { x: 46, y: 26, r: 5 },
  { x: 72, y: 22, r: -6 },
];

export const PILE_TOP = { x: 44, y: 6, r: 3 };

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

export function CoinPile() {
  return (
    <div className="cb-coin-pile">
      {PILE_LAYOUT.map(({ x, y, r }, i) => (
        <div
          key={i}
          className="cb-pile-coin"
          style={{
            left: `calc(${x} * var(--cb-scale, 1px))`,
            top: `calc(${y} * var(--cb-scale, 1px))`,
            transform: `rotate(${r}deg)`,
          }}
        />
      ))}
    </div>
  );
}
