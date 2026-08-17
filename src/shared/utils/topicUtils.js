export function deriveConcepts(cards) {
  const map = new Map();
  for (const card of cards) {
    const conceptId = card.conceptId ?? card.id;
    const label     = typeof card.label === "string"
      ? card.label
      : (card.labels?.ru ?? card.labels?.en ?? card.answerKey ?? conceptId);
    const normalized = { ...card, conceptId, label };

    if (!map.has(conceptId)) {
      map.set(conceptId, { conceptId, cards: [], primary: null });
    }
    const concept = map.get(conceptId);
    concept.cards.push(normalized);
    if (card.primary || concept.primary === null) concept.primary = normalized;
  }
  return [...map.values()];
}

// symmetry_draw bundles three unrelated task kinds (mirror, repeat,
// dictation) as one card array with a `taskKind` field per card, one mode
// per kind. Same reasoning as word_agreement below: without this, every
// mode's concept picker would list all three kinds' concepts mixed
// together, and picking concepts for "Симметричный рисунок" would also
// offer repeat/dictation figures that mode never draws.
const TASK_KIND_BY_MODE_TYPE = {
  mirror_draw: "mirror",
  repeat_draw: "repeat",
  navigator: "navigator",
  coordinates: "coordinates",
};

const FIGURE_MODE_TYPES = new Set(["mirror_draw", "repeat_draw", "graphic_dictation"]);

function isSymmetryDrawFigureMode(topicRecord, mode) {
  return topicRecord?.meta?.id === "symmetry_draw" && FIGURE_MODE_TYPES.has(mode?.type);
}

// Figure filters belong to a particular exercise, not to the whole topic.  In
// particular, the two variants of graphic dictation draw from different card
// pools.  Keeping the filter in one namespaced object prevents a parent's
// choice for "Повтори рисунок" from unexpectedly changing "Симметрию".
export function getFigureFilterKey(mode, params = {}) {
  const variant = mode?.type === "graphic_dictation"
    ? `:${params.dictationCommand === "coordinates" ? "coordinates" : "directions"}`
    : "";
  return `${mode?.id ?? "figure"}${variant}`;
}

export function getFigureFilter(params = {}, mode) {
  const saved = params.figureFilters?.[getFigureFilterKey(mode, params)];
  if (saved?.type === "manual" && Array.isArray(saved.cardIds) && saved.cardIds.length) {
    return { type: "manual", cardIds: saved.cardIds };
  }
  if (saved?.type === "difficulty" && typeof saved.difficulty === "string") {
    return { type: "difficulty", difficulty: saved.difficulty };
  }
  // `figureDifficulty` is kept as a one-release migration path for settings
  // saved before the visual picker existed.
  return { type: "difficulty", difficulty: params.figureDifficulty ?? "all" };
}

export function withFigureFilter(params = {}, mode, filter) {
  const key = getFigureFilterKey(mode, params);
  return {
    ...params,
    figureFilters: {
      ...(params.figureFilters ?? {}),
      [key]: filter,
    },
  };
}

// word_agreement bundles several unrelated skills (case, verb number, verb
// gender, ...) as one big card array with a `skill` field per card, one
// mode per skill. Without this, the concept picker would list every card in
// the whole topic regardless of which mode is open — e.g. picking concepts
// for "Числительное + существительное" would also show all the case/verb
// cards that mode never uses. Every other renderer keeps one card set per
// mode already, so this is a no-op for them.
export function getConceptCards(topicRecord, mode, params = {}) {
  const cards = topicRecord?.cards ?? [];
  if (topicRecord?.meta?.renderer === "word_agreement" && mode?.type) {
    return cards.filter((c) => c.skill === mode.type);
  }
  const taskKind = mode?.type === "graphic_dictation"
    ? (params.dictationCommand === "coordinates" ? "coordinate" : "dictation")
    : (mode?.type ? TASK_KIND_BY_MODE_TYPE[mode.type] : undefined);
  const modeCards = taskKind ? cards.filter((c) => c.taskKind === taskKind) : cards;
  if (isSymmetryDrawFigureMode(topicRecord, mode)) {
    const figureFilter = getFigureFilter(params, mode);
    if (figureFilter.type === "manual") {
      const selected = new Set(figureFilter.cardIds);
      return modeCards.filter((card) => selected.has(card.id));
    }
    if (figureFilter.difficulty !== "all") {
      return modeCards.filter((card) => card.difficulty === figureFilter.difficulty);
    }
  }
  return modeCards;
}

// True when this mode only draws from part of the topic's cards (symmetry_draw's
// taskKind-scoped modes, word_agreement's skill-scoped modes) rather than the
// whole topic. These modes' concept selections must be remembered separately per
// mode - see readModeSelectedConceptIds/writeModeSelectedConceptIds below.
export function isConceptSelectionScopedByMode(topicRecord, mode, params) {
  if (!mode) return false;
  const allCards = topicRecord?.cards ?? [];
  return getConceptCards(topicRecord, mode, params).length !== allCards.length;
}

function getSelectionPrefix(topicRecord, mode, params) {
  const variant = mode?.type === "graphic_dictation"
    ? `:${params?.dictationCommand === "coordinates" ? "coordinates" : "directions"}`
    : "";
  const figureDifficulty = isSymmetryDrawFigureMode(topicRecord, mode)
    ? `:${params?.figureDifficulty ?? "all"}`
    : "";
  return `${mode.id}${variant}${figureDifficulty}::`;
}

// The student-topic link has a single shared selectedConceptIds array (one
// backend column, one JSON blob) covering every mode of the topic. For a topic
// whose modes share that one array but draw from disjoint card pools (e.g.
// symmetry_draw's mirror/repeat/dictation), confirming a selection in one mode
// would silently overwrite - and appear to ignore - whatever was chosen in
// another. Namespacing entries as "<modeId>::<conceptId>" inside the same flat
// array keeps every mode's choice isolated without any backend schema change.
export function readModeSelectedConceptIds(topicRecord, mode, rawSelectedConceptIds, params) {
  if (!rawSelectedConceptIds?.length) return null;
  if (!isConceptSelectionScopedByMode(topicRecord, mode, params)) return rawSelectedConceptIds;
  const prefix = getSelectionPrefix(topicRecord, mode, params);
  const own = rawSelectedConceptIds
    .filter((id) => id.startsWith(prefix))
    .map((id) => id.slice(prefix.length));
  // Selections made before the difficulty filter used the shorter namespace.
  // Keep those choices when opening the default “all levels” pool once after
  // the upgrade; level-specific selections remain independent from then on.
  if (!own.length && isSymmetryDrawFigureMode(topicRecord, mode) && (params?.figureDifficulty ?? "all") === "all") {
    const legacyVariant = mode?.type === "graphic_dictation"
      ? `:${params?.dictationCommand === "coordinates" ? "coordinates" : "directions"}`
      : "";
    const legacyPrefix = `${mode.id}${legacyVariant}::`;
    const legacy = rawSelectedConceptIds
      .filter((id) => id.startsWith(legacyPrefix))
      .map((id) => id.slice(legacyPrefix.length));
    if (legacy.length) return legacy;
  }
  return own.length ? own : null;
}

export function writeModeSelectedConceptIds(topicRecord, mode, rawSelectedConceptIds, newIdsForMode, params) {
  if (!isConceptSelectionScopedByMode(topicRecord, mode, params)) return newIdsForMode;
  const prefix = getSelectionPrefix(topicRecord, mode, params);
  const otherModes = (rawSelectedConceptIds ?? []).filter((id) => !id.startsWith(prefix));
  return [...otherModes, ...newIdsForMode.map((id) => `${prefix}${id}`)];
}

export function getPrimaryCard(cards, conceptId) {
  return cards.find((c) => c.conceptId === conceptId && c.primary) ?? null;
}

export function pickVariation(concept, excludeCardId = null) {
  const pool =
    concept.cards.length > 1
      ? concept.cards.filter((c) => c.id !== excludeCardId)
      : concept.cards;
  return pool[Math.floor(Math.random() * pool.length)];
}
