export default function DotGroup({ count, color, number }) {
  return (
    <div className="pilot-dot-group-wrap">
      <div className="pilot-dot-group">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="pilot-dot" style={{ background: color }} />
        ))}
      </div>
      {number !== undefined && (
        <div className="pilot-dot-group-number">{number}</div>
      )}
    </div>
  );
}
