// Two more kinds of a letter row besides «пишем букву» (owner, 2026-11-05; mockup
// docs/mockups/print-letters-missing-stroke.html, docs/print-letters.md «Допиши штрих и Найди и обведи»):
//
//  - «Допиши штрих» (`task: "miss"`): the row's sample is the whole letter, then every copy is the
//    letter printed solid without one stroke; the child writes the missing one. Ilyukhina's «впиши
//    недостающий элемент». Two steps of help only (owner): a green dot where the missing stroke starts
//    (`hint: "dot"`), then nothing (`hint: "none"`) — no dotted line: that would be tracing again, which
//    the contour rows above already give; here the child has to see which stroke the letter lacks.
//    The missing stroke goes in turn, copy after copy (no setting «which stroke»), unless the row fixes
//    one (`stroke`, the hidden-letter sheets: Г → П always lacks П's right stick).
//  - «Найди и обведи» (`task: "find"`): a row of letters printed all alike, light, without dots — the
//    block's letter among similar ones; the child traces only the letter on the plate.
//
// The target of both is always the block's own letter (owner, 2026-11-05: a letter without a stroke
// often reads as another letter — П without its right stick is Г — so a mixed row has no defined
// target; the plate names it).

export const TASKS = [
  { id: "write", label: "Пишем букву" },
  { id: "miss", label: "Допиши штрих" },
  { id: "find", label: "Найди и обведи" },
];
export const MISS_HINTS = [
  { id: "dot", label: "Точка начала" },
  { id: "none", label: "Без подсказки" },
];

export function rowTask(row) {
  return row?.task === "miss" || row?.task === "find" ? row.task : "write";
}
export function missHint(row) {
  return row?.hint === "none" ? "none" : "dot";
}

// ---- «Допиши штрих» ---------------------------------------------------------

const nums = (d) => (String(d).match(/-?\d*\.?\d+/g) || []).map(Number);
// the length of a stroke's control polygon — enough to tell a real stroke from Ё's dots
function roughLen(d) {
  const n = nums(d);
  let len = 0;
  for (let i = 2; i + 1 < n.length; i += 2) len += Math.hypot(n[i] - n[i - 2], n[i + 1] - n[i - 1]);
  return len;
}

// The parts a letter can lack. A letter of one stroke (О, С) has its curve cut in two halves at the
// middle of its arcs: О's left and right halves, С's top and bottom; the others — their strokes.
export function missParts(letter) {
  const strokes = letter?.strokes ?? [];
  if (strokes.length === 1) {
    const s = strokes[0];
    const segs = String(s.d).match(/C[^C]*/g);
    const m = /^\s*M\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/.exec(s.d);
    if (segs && segs.length >= 2 && m) {
      const half = Math.ceil(segs.length / 2);
      const end = (k) => { const n = nums(segs[k - 1]); return `${n[n.length - 2]},${n[n.length - 1]}`; };
      return [
        { d: `M ${m[1]},${m[2]} ${segs.slice(0, half).join(" ")}`.trim(), name: `первая половина: ${s.name ?? ""}`.trim() },
        { d: `M ${end(half)} ${segs.slice(half).join(" ")}`.trim(), name: `вторая половина: ${s.name ?? ""}`.trim() },
      ];
    }
  }
  return strokes.map((s) => ({ d: s.d, name: s.name }));
}

// Which parts may go missing: not the small ones the child would hardly see (Ё's dots, Й's breve,
// the tails of Ц and Щ, Д's feet, Ъ's bar, Ю's bar) — unless the row fixes one.
const MIN_LINE = 30;
const MIN_CURVE = 40;
export function missable(letter) {
  return missParts(letter)
    .map((p, i) => ({ i, len: roughLen(p.d), curve: /C/.test(p.d) }))
    .filter((p) => p.len >= (p.curve ? MIN_CURVE : MIN_LINE))
    .map((p) => p.i);
}

export function canMiss(letter) {
  return missable(letter).length > 0 && missParts(letter).length > 1;
}

// Copy k after the sample: which part it lacks.
export function missingPart(letter, k, fixed) {
  const parts = missParts(letter);
  if (Number.isInteger(fixed) && fixed >= 0 && fixed < parts.length) return fixed;
  const list = missable(letter);
  return list.length ? list[k % list.length] : -1;
}

// The copy as a letter of its own: the remaining parts, and the start of the missing one.
export function missCopy(letter, k, fixed) {
  const parts = missParts(letter);
  const gone = missingPart(letter, k, fixed);
  const m = gone >= 0 ? /^\s*M\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/.exec(parts[gone].d) : null;
  return {
    letter: { ...letter, strokes: parts.filter((_, i) => i !== gone) },
    gone,
    start: m ? [Number(m[1]), Number(m[2])] : null,
  };
}

// ---- «Найди и обведи» --------------------------------------------------------
// Printed letters that look alike — the same family and shared strokes, the usual confusions of
// preschoolers (П/Н/И, Ь/Б/Р/В, С/О/Э …). Only letters the deck has are used.
export const SIMILAR = {
  Г: "ПТЕН", Т: "ГПШ", П: "НИГЛ", Н: "ПИЧ", И: "НЙП", Ш: "ЩИЦП", Е: "ЁБГ", Ё: "ЕБ", Ч: "ЦУН",
  Л: "ДАПМ", А: "ЛДЯ", Й: "ИНЦ", Д: "ЛЦА", Ц: "ЩЧД", Щ: "ШЦ", У: "ЧХК", Х: "ЖКУ", К: "ЖХЯ",
  Ж: "КХ", М: "ЛИН", Ь: "ЪЫБРВ", Ъ: "ЬЫБ", Ы: "ЬЪ", Р: "ЬВЯБ", Б: "ЬВР", Ф: "РО", Я: "РКЬ",
  В: "БЬЗР", З: "ВЭ", О: "СЮЭ", Ю: "ОН", С: "ОЭ", Э: "СЗ",
};

export function similarTo(letter, byId) {
  const list = [...(SIMILAR[letter?.id] ?? "")].filter((id) => byId?.[id] && id !== letter.id);
  return list.map((id) => byId[id]);
}

function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The row's letters: about every third one is the target (at least two), never two targets side by
// side, never the same lookalike twice in a row. Seeded by the row's id, so the row stays the same on
// screen, in the thumbnails and in the PDF.
export function findSequence(letter, count, seed, byId) {
  const others = similarTo(letter, byId);
  if (!others.length || count < 3) return Array.from({ length: count }, () => letter);
  const rand = rng(hash(`${seed}:${letter.id}`));
  const want = Math.max(2, Math.round(count / 3));
  const slots = new Set();
  let guard = 0;
  while (slots.size < want && guard++ < 500) {
    const i = Math.floor(rand() * count);
    if (!slots.has(i - 1) && !slots.has(i + 1)) slots.add(i);
  }
  const out = [];
  for (let i = 0; i < count; i++) {
    if (slots.has(i)) { out.push(letter); continue; }
    const prev = out[i - 1];
    const pool = others.length > 1 ? others.filter((o) => o !== prev) : others;
    out.push(pool[Math.floor(rand() * pool.length)]);
  }
  return out;
}

// The widest letter that may stand in the row (a wide lookalike must not run past the block's edge).
export function findWidest(letter, byId) {
  return [letter, ...similarTo(letter, byId)].reduce((a, b) => ((Number(b.cells) || 1) > (Number(a.cells) || 1) ? b : a), letter);
}

export function describeTask(row) {
  const t = rowTask(row);
  if (t === "miss") return `допиши штрих · ${missHint(row) === "dot" ? "точка начала" : "без подсказки"}${Number.isInteger(row.stroke) ? " · всегда тот же штрих" : ""}`;
  if (t === "find") return "найди и обведи";
  return null;
}
