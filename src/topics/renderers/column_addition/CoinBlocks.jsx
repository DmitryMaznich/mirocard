// Fixed heap layout (not randomized per render) so the pile's silhouette
// stays recognizable across reloads — wide base narrowing to one coin at
// the apex, which gets the idle "pick me" bob.
const PILE_LAYOUT = [
  { x: 4, y: 40, r: -8 },
  { x: 30, y: 44, r: 6 },
  { x: 56, y: 42, r: -4 },
  { x: 82, y: 40, r: 10 },
  { x: 18, y: 24, r: -10 },
  { x: 46, y: 26, r: 5 },
  { x: 72, y: 22, r: -6 },
  { x: 44, y: 6, r: 3, top: true },
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
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="cb-stack-coin" />
      ))}
      {numeric && <div className="cb-stack-badge">10</div>}
    </div>
  );
}

export function CoinPile() {
  return (
    <div className="cb-coin-pile">
      {PILE_LAYOUT.map(({ x, y, r, top }, i) => (
        <div
          key={i}
          className={`cb-pile-coin${top ? " cb-pile-coin--top" : ""}`}
          style={{ left: `${x}px`, top: `${y}px`, transform: `rotate(${r}deg)` }}
        />
      ))}
    </div>
  );
}
