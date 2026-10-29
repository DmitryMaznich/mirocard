export function computeDefaultParams(topicRecord, mode) {
  const renderer = topicRecord?.meta?.renderer;
  if (renderer === "comparison") {
    // «Сравни и нажми» starts with pairs at level 1, and pairs come with «поровну».
    const isVisual = mode?.id === "compare_visual";
    const isTest = mode?.id === "compare_test";
    return { level: isVisual ? 1 : 2, question: "more", showEqual: isVisual, wordsVerdict: false,
             visualMode: isVisual ? "pairing" : "dots", examplesCount: isTest ? 8 : 1, showLabels: true, style: "sign",
             ...(isTest ? { testRange: 20 } : {}) };
  }
  const out = {};
  for (const [key, def] of Object.entries(mode?.params ?? {})) {
    if (def.type === "concept_selector" || def.type === "sentence_list") continue;
    out[key] = def.default ?? (def.type === "number" ? def.min : (def.values?.[0] ?? null));
  }
  return out;
}
