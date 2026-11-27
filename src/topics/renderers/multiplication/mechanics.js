// «Умножение» (multiplication): what each exercise contains, per mode and level.
// Pure functions of (level, rng) — no React, no language, no account state.
// Methodology and the reasons for every rule: docs/multiplication-methodology.md.

export const LEVELS = {
  equal_check: ["R", "A", "B", "D"],
  make_equal: ["R", "A", "B", "C", "D"],
  skip_count: ["R", "A", "B", "C", "D"],
  sum_to_product: ["R", "A", "B", "C"],
};

// Small deterministic generator so a task (seed) always shows the same exercise.
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
export const pick = (rng, list) => list[Math.floor(rng() * list.length)];
export function shuffled(rng, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// «Как на кубике»: one fixed layout per count (centres in % of the container).
export const DICE = {
  0: [], 1: [[50, 50]], 2: [[34, 34], [66, 66]], 3: [[50, 30], [31, 65], [69, 65]],
  4: [[33, 33], [67, 33], [33, 67], [67, 67]], 5: [[31, 31], [69, 31], [50, 50], [31, 69], [69, 69]],
  6: [[33, 26], [67, 26], [33, 50], [67, 50], [33, 74], [67, 74]],
  7: [[30, 26], [70, 26], [30, 50], [50, 50], [70, 50], [30, 74], [70, 74]],
  8: [[30, 24], [50, 24], [70, 24], [30, 50], [70, 50], [30, 76], [50, 76], [70, 76]],
};

// More than 8 only happens after moves «не туда» in make_equal: an even grid.
export function layout(n) {
  if (DICE[n]) return DICE[n];
  const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), pts = [];
  for (let k = 0; k < n; k++) {
    const r = Math.floor(k / cols), c = k % cols;
    pts.push([24 + (cols === 1 ? 26 : (c * 52) / (cols - 1)), 24 + (rows === 1 ? 26 : (r * 52) / (rows - 1))]);
  }
  return pts;
}

// Own random scatter per group, without overlaps (equal_check level D).
export function scatter(n, rng) {
  for (let t = 0; t < 200; t++) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      let p, ok = false;
      for (let k = 0; k < 60 && !ok; k++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 27;
        p = [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
        ok = pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 25);
      }
      if (!ok) break;
      pts.push(p);
    }
    if (pts.length === n) return pts;
  }
  return DICE[n];
}

// ── ступень 0 «Поровну?» ── always two groups; `equal` comes from the engine
// (balanced, never more than two same answers in a row).
export function equalExercise(level, equal, rng) {
  if (equal) { const n = randInt(rng, 2, 5); return { counts: [n, n], scatter: level === "D" }; }
  const [minDiff, maxDiff] = level === "R" || level === "A" ? [2, 5] : [1, 1];
  let a, b;
  do { a = randInt(rng, 1, 6); b = randInt(rng, 1, 6); }
  while (a === b || Math.abs(a - b) < minDiff || Math.abs(a - b) > maxDiff);
  return { counts: [a, b], scatter: level === "D" };
}

// ── ступень 1 «Сделай поровну» ── `min` = the shortest number of moves.
export const minMoves = (counts, target) => counts.reduce((s, x) => s + Math.max(0, x - target), 0);
export function makeEqualExercise(level, rng) {
  for (;;) {
    const n = level === "D" ? randInt(rng, 3, 4) : level === "C" ? 3 : 2;
    const t = randInt(rng, 2, n === 4 ? 4 : 5);
    const c = Array(n).fill(t);
    const moves = { R: 1, A: 1, B: 2, C: randInt(rng, 1, 2), D: randInt(rng, 2, 3) }[level];
    for (let k = 0; k < moves; k++) {
      const from = randInt(rng, 0, n - 1), to = randInt(rng, 0, n - 1);
      if (from === to || c[to] === 0) { k--; continue; }
      c[to]--; c[from]++;
    }
    const m = minMoves(c, t);
    if (m !== moves || Math.max(...c) > 8) continue;
    if (level === "D" && c.filter((x) => x !== t).length < 3) continue;
    return { counts: shuffled(rng, c), target: t, min: m };
  }
}

// Group kinds: R and A keep the familiar apples on plates; from B they alternate
// (bananas only up to 3 — more do not fit a plate).
export function groupKind(level, size, rng, { always = false } = {}) {
  if (!always && (level === "R" || level === "A")) return "apple";
  return pick(rng, size <= 3 ? ["apple", "banana", "egg"] : ["apple", "egg"]);
}

// ── ступень 2 «Считаем группами» ── start with «по 2» and «по 5».
export function skipCountExercise(level, rng) {
  const sizes = { R: [2, 5], A: [2, 5], B: [3, 4], C: [2, 3, 4, 5], D: [2, 3, 4, 5] }[level];
  const size = pick(rng, sizes);
  const groups = level === "D" ? randInt(rng, 3, 5) : randInt(rng, 3, 4);
  return { size, groups, kind: groupKind(level, size, rng) };
}

// Choices for the running total over group i (0-based): the typical mistakes are
// «прибавил одно вместо группы» (prev + 1) and «обсчитался на одно» (total ± 1).
export function skipChoices(level, size, i, rng) {
  const total = size * (i + 1), prev = size * i;
  const opts = [total, i === 0 ? 1 : prev + 1];
  if (level !== "A") opts.push(rng() < 0.5 ? total + 1 : total - 1);
  return shuffled(rng, [...new Set(opts.filter((x) => x > 0))]);
}

// ── ступень 3 «Сложение → умножение» ── never a × a, product up to 20,
// groups vary from the first task (the skill is known from step 2).
export function sumExercise(level, rng) {
  let size, groups;
  do { size = randInt(rng, 2, 5); groups = randInt(rng, 2, 5); } while (size === groups || size * groups > 20);
  const exercise = { size, groups, kind: groupKind(level, size, rng, { always: true }) };
  if (level === "C") {
    exercise.hide = rng() < 0.5 ? "size" : "groups";
    const right = exercise.hide === "size" ? size : groups, other = exercise.hide === "size" ? groups : size;
    const opts = [right, other];
    for (const d of [1, -1, 2, -2]) if (opts.length < 3 && right + d >= 2 && right + d <= 6 && !opts.includes(right + d)) opts.push(right + d);
    exercise.choices = shuffled(rng, opts);
  } else if (level === "A" || level === "B") {
    exercise.asks = rng() < 0.5 ? ["size", "groups"] : ["groups", "size"];
  }
  return exercise;
}

// ── adaptive level within a lesson ──
// `history` holds the last results (true = «чисто»); the rules per mode follow the doc.
export function nextLevel(modeId, state, result) {
  const order = LEVELS[modeId];
  const i = order.indexOf(state.level);
  const history = [result.clean, ...state.history].slice(0, 10);
  const strike = result.down ? state.strike + 1 : 0;
  const out = { ...state, history, strike };
  if ((modeId === "equal_check" && !result.clean && i > 0) || (strike >= 2 && i > 0)) {
    return { ...out, level: order[i - 1], history: [], strike: 0 };
  }
  if (history.length >= 10 && history.filter(Boolean).length >= 8 && i < order.length - 1) {
    // Step 0: once A is mastered, the rows check comes only after a mistake.
    return { ...out, level: order[i + 1], history: [], strike: 0, rowsAlways: modeId === "equal_check" && state.level === "A" ? false : state.rowsAlways };
  }
  return out;
}

// The record in the order the school of this language writes it.
// ru: «по 3 взять 4 раза» → 3 × 4 (size first); sl/en: 4 · 3 (groups first).
export function recordOrder(order, size, groups) {
  const sizePart = { role: "size", value: size }, groupsPart = { role: "groups", value: groups };
  return order === "groups-first" ? [groupsPart, sizePart] : [sizePart, groupsPart];
}
