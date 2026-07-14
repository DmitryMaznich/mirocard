export function UnitCube({ numeric = false }) {
  if (numeric) {
    return <div className="pv-numeric-block pv-numeric-block--unit">1</div>;
  }
  return <div className="pv-cube" />;
}

export function TenCard({ dim = false, numeric = false }) {
  if (numeric) {
    return (
      <div className={`pv-numeric-block pv-numeric-block--ten${dim ? " pv-numeric-block--dim" : ""}`}>
        10
      </div>
    );
  }
  return (
    <div className={`pv-ten-card${dim ? " pv-ten-card--dim" : ""}`}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="pv-ten-seg" />
      ))}
    </div>
  );
}
