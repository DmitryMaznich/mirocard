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
//   joinCut    — {stroke, at: "bottom" | keep}: the letter ends on its own side (У: the lower hook curls up-left); when a letter follows, the cubics after the lowest point
//                are replaced by the connector of `joinLike` (о) from the lowest point; alone the letter keeps its hook
export const P2_GLYPH_OVERRIDES = {
  "о": { tailSplit: 0, tailLift: true, tailContinuous: true },
  "ю": { tailSplit: 0, tailLift: true, tailContinuous: true },
  "ф": { tailSplit: 0, tailLift: true, tailContinuous: true },
  "в": { tailSplit: 0, tailLift: true, tailContinuous: true },
  "б": { tailStroke: 1, tailLift: true },
  "э": { tailStroke: 2, tailLift: true },
  // capital У: from its lowest point the connector is the same as after о (a little along the bottom, then right and up to the middle of the row)
  "У": { joinCut: { stroke: 0, at: "bottom" }, joinLikeLabel: "о", tailContinuous: true },
};

export const withGlyphOverrides = (glyphs) => {
  const patched = (glyphs ?? []).map((g) => (P2_GLYPH_OVERRIDES[g.label] ? { ...g, ...P2_GLYPH_OVERRIDES[g.label] } : g));
  // `joinLikeLabel` -> the (already patched) glyph whose connector is borrowed
  return patched.map((g) => (g.joinLikeLabel ? { ...g, joinLike: patched.find((x) => x.label === g.joinLikeLabel) } : g));
};
