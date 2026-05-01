export default function DotGroup({ count, color }) {
  return (
    <div className="dot-group">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="dot" style={{ background: color }} />
      ))}
    </div>
  );
}
