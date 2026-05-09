export default function DotGroup({ count, color, number }) {
  return (
    <div className="dot-group-wrap">
      <div className="dot-group">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="dot" style={{ background: color }} />
        ))}
      </div>
      {number !== undefined && (
        <div className="dot-group-number">{number}</div>
      )}
    </div>
  );
}
