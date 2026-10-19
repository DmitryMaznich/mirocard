// Level 5 «По разрядам», after a mistake: both numbers by places, and which
// place decides — compare from the highest place down. Colours as in «Разряды
// числа» (hundreds green, tens orange, ones blue), copied into comparison.css.
const PLACES = [
  { key: "hundreds", name: "Сотни", gen: "сотни" },
  { key: "tens", name: "Десятки", gen: "десятки" },
  { key: "ones", name: "Единицы", gen: "единицы" },
];

export function placeHintText(a, b) {
  if (String(a).length !== String(b).length) {
    const [big, small] = a > b ? [a, b] : [b, a];
    return `В числе ${big} есть сотни, в ${small} — нет. ${big} больше.`;
  }
  const width = String(a).length;
  const da = String(a).padStart(3, "0"), db = String(b).padStart(3, "0");
  const said = [];
  for (let i = 3 - width; i < 3; i++) {
    if (da[i] === db[i]) { said.push(`${PLACES[i].name} поровну.`); continue; }
    const big = da[i] > db[i] ? a : b;
    said.push(`${PLACES[i].name}: ${da[i]} и ${db[i]} — больше у ${big}.`);
    break;
  }
  return said.join(" ");
}

export default function PlaceHint({ left, right }) {
  const width = Math.max(String(left).length, String(right).length);
  const places = PLACES.slice(3 - width);
  const digits = (n) => String(n).padStart(width, " ").split("");
  const da = digits(left), db = digits(right);
  const decide = places.findIndex((_, i) => da[i] !== db[i]);
  return <div className="cmp-place-hint" aria-live="polite">
    <div className="cmp-place-table" style={{ gridTemplateColumns: `auto repeat(${places.length}, auto)` }}>
      <span />
      {places.map((p, i) => <span key={p.key} className={`cmp-place-head cmp-place-head--${p.key}${i === decide ? " cmp-place--decide" : ""}`}>{p.name}</span>)}
      {[[left, da], [right, db]].map(([n, ds]) => [
        <span key={`${n}-n`} className="cmp-place-num">{n}</span>,
        ...places.map((p, i) => <span key={`${n}-${p.key}`} className={`cmp-place-digit cmp-place-digit--${p.key}${i === decide ? " cmp-place--decide" : ""}`}>{ds[i].trim() || "—"}</span>),
      ])}
    </div>
    <div className="cmp-place-say">{placeHintText(left, right)}</div>
  </div>;
}
