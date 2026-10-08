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
