export function RaceCar({ className = "" }) {
  return <svg className={className} viewBox="0 0 150 88" aria-hidden="true">
    <ellipse cx="76" cy="78" rx="63" ry="6" fill="#24324a" opacity=".09" />
    <path d="m29 39 16-24c6-9 36-9 47 0l22 24" fill="currentColor" />
    <path d="m47 34 9-15h17v17H45zm33-15h7l18 17H80z" fill="#d6efec" />
    <rect x="10" y="35" width="133" height="36" rx="15" fill="currentColor" />
    <rect x="128" y="44" width="13" height="10" rx="4" fill="#ffe8a3" />
    <rect x="10" y="45" width="7" height="9" rx="3" fill="#fff0df" />
    <path d="M84 44h12" stroke="#24324a" strokeOpacity=".18" strokeWidth="4" strokeLinecap="round" />
    {[40, 114].map(x => <g key={x}><circle cx={x} cy="69" r="15" fill="#29374c" /><circle cx={x} cy="69" r="7" fill="#e9e5de" /></g>)}
  </svg>;
}

const PIPS = { 1: [[50,50]], 2: [[26,26],[74,74]], 3: [[26,26],[50,50],[74,74]], 4: [[26,26],[74,26],[26,74],[74,74]], 5: [[26,26],[74,26],[50,50],[26,74],[74,74]], 6: [[26,24],[74,24],[26,50],[74,50],[26,76],[74,76]] };
export function DiceFace({ value }) {
  return <svg className="race-die" viewBox="0 0 100 100" aria-hidden="true">
    <rect x="3" y="3" width="94" height="94" rx="20" fill="#fffdfa" stroke="currentColor" strokeWidth="3" />
    {value ? PIPS[value].map(([x,y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="8" fill="currentColor" />) : <text x="50" y="69" textAnchor="middle" fontSize="54" fill="currentColor">?</text>}
  </svg>;
}
