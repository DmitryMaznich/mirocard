// The topic's coin and stack of ten (styles in coins.css).
export function Coin({ numeric = false }) {
  return (
    <div className="cb-coin">
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

// «Схема» — the step from coins to digits (docs/place-value-methodology.md,
// раздел 8): a ten is a stick, a one is a dot. Same cell sizes as the stack and
// the coin, so every layout built for coins holds unchanged.
export function SchemeOne() {
  return <div className="cb-dot-cell"><div className="cb-dot" /></div>;
}

export function SchemeTen() {
  return <div className="cb-stick-cell"><div className="cb-stick" /></div>;
}

export function modelPieces(view) {
  return view === "scheme" ? { One: SchemeOne, Ten: SchemeTen } : { One: Coin, Ten: TenStack };
}
