// «Прописи 2» glyph facts that differ from the shared tools/propis/wide.json (which the frozen v1 copybook also builds from).
//
// The exit rise that joins a letter to the next one is not part of every letter. For о б ю э ф в it is a canonical
// connector appended to the letter (the very same curve on all of them), so the letter written ALONE has none and with it only when a
// letter follows. For г п т и н к л м, and also с х ж (confirmed: it is part of the letter even though the curve looks the same)... the final hook is the letter's own stroke and stays. (Found by looking for that exact
// connector as the last curve of every captured letter; see docs/propis2.md.)
//   tailSplit  — index of the stroke whose last curve is the connector
//   tailStroke — index of a stroke that IS the connector (a stroke of its own in the capture)
//   tailLift   — the connector gets the "end above the dashed line" lift the letter's exit used to get
//   tailContinuous — the pen does not lift between the letter and its connector
//   joinFrom   — {stroke}: the letter ends on its own side (У: the lower hook curls up-left and is part of the letter, never cut); the connector to the next
//                letter is a stroke of its own from the LOWEST point of that stroke: the curve of `joinLike` (о), its end on the grid point where the exit of
//                `joinEndLike` (Ч: the same start as У) arrives (the mid dashed line x the next slant line, the same for every connector)
export const P2_GLYPH_OVERRIDES = {
  "о": { tailSplit: 0, tailLift: true, tailContinuous: true },
  "ю": { tailSplit: 0, tailLift: true, tailContinuous: true },
  "ф": { tailSplit: 0, tailLift: true, tailContinuous: true },
  "в": { tailSplit: 0, tailLift: true, tailContinuous: true },
  "ь": { tailSplit: 0, tailLift: true, tailContinuous: true },
  "ъ": { tailSplit: 0, tailLift: true, tailContinuous: true },
  "б": { tailStroke: 1, tailLift: true },
  "э": { tailStroke: 2, tailLift: true },
  // capital У: whole, with its hook; the connector leaves its lowest point like о's and arrives where Ч's exit does (У is «как Ч»)
  "У": { joinFrom: { stroke: 0 }, joinLikeLabel: "о", joinEndLikeLabel: "Ч" },
};

export const withGlyphOverrides = (glyphs) => {
  const patched = (glyphs ?? []).map((g) => (P2_GLYPH_OVERRIDES[g.label] ? { ...g, ...P2_GLYPH_OVERRIDES[g.label] } : g));
  // `joinLikeLabel` -> the (already patched) glyph whose connector is borrowed
  return patched.map((g) => (g.joinLikeLabel ? { ...g, joinLike: patched.find((x) => x.label === g.joinLikeLabel), joinEndLike: patched.find((x) => x.label === g.joinEndLikeLabel) } : g));
};
