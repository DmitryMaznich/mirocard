export function UnitCube() {
  return <div className="pv-cube" />;
}

export function TenCard({ dim = false }) {
  return (
    <div className={`pv-ten-card${dim ? " pv-ten-card--dim" : ""}`}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="pv-ten-seg" />
      ))}
    </div>
  );
}
