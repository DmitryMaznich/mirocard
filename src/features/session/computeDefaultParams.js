export function computeDefaultParams(topicRecord, mode) {
  const renderer = topicRecord?.meta?.renderer;
  if (renderer === "comparison") {
    return { level: 2, question: "more", showEqual: false, wordsVerdict: false,
             visualMode: "dots", examplesCount: 1, showLabels: true, style: "sign" };
  }
  const out = {};
  for (const [key, def] of Object.entries(mode?.params ?? {})) {
    if (def.type === "concept_selector" || def.type === "sentence_list") continue;
    out[key] = def.default ?? (def.type === "number" ? def.min : (def.values?.[0] ?? null));
  }
  return out;
}
