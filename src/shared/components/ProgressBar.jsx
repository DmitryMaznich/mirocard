export default function ProgressBar({ value, max, className = "" }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={`progress-bar ${className}`} title={`${pct}%`}>
      <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
