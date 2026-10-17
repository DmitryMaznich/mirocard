// «Названия чисел»: which number is spoken and which written numbers it is
// shown among (NumberNamesTask.jsx; generated in engine.js).
// Sets, easiest first: round tens; 11–19 together with the round tens (the
// pairs that sound alike); round hundreds; two-digit; three-digit.
export const NAME_SETS = {
  tens: [10, 20, 30, 40, 50, 60, 70, 80, 90],
  teens_tens: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 30, 40, 50, 60, 70, 80, 90],
  hundreds: [100, 200, 300, 400, 500, 600, 700, 800, 900],
};

// Numbers that sound like `n`, closest first.
export function confusables(n) {
  const out = [];
  const push = (v) => { if (v !== n && v > 0 && v <= 999 && !out.includes(v)) out.push(v); };
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10;
  if (n >= 11 && n <= 19) { push(o * 10); push(o * 100); push(o); }
  else if (n < 100 && o === 0) { push(10 + t); push(t * 100); push(t); }
  else if (n >= 100 && n % 100 === 0) { push(h * 10); push(10 + h); push(h); }
  else if (n < 100) { push(o * 10 + t); push(10 + o); push(t * 10); push(n + 10 <= 99 ? n + 10 : n - 10); }
  else {
    if (t === 0) { push(h * 100 + o * 10); push(h * 10 + o); }
    else if (o === 0) { push(h * 100 + t); push(h * 10 + t); }
    else { push(h * 100 + o * 10 + t); push(h * 100 + t * 10); }
    push(t * 100 + h * 10 + o);
    push(h * 100 + ((t + 1) % 10) * 10 + o);
  }
  return out;
}

export function numberNameOptions(n, random = Math.random) {
  const options = [n, ...confusables(n).slice(0, 2)];
  for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
  return options;
}

export function numberNamesNumber(set, random = Math.random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const int = (a, b) => a + Math.floor(random() * (b - a + 1));
  if (NAME_SETS[set]) return pick(NAME_SETS[set]);
  if (set === "two_digit") { let v; do v = int(21, 99); while (v % 10 === 0); return v; }
  if (set === "three_digit") { let v; do v = int(101, 999); while (v % 100 === 0); return v; }
  if (set === "mix100") return numberNamesNumber(pick(["tens", "teens_tens", "two_digit"]), random);
  if (set === "mix1000") return numberNamesNumber(pick(["hundreds", "three_digit"]), random);
  return numberNamesNumber(pick(["tens", "teens_tens", "hundreds", "two_digit", "three_digit"]), random);
}

