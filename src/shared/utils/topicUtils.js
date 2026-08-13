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
  graphic_dictation: "dictation",
  coordinate_dictation: "coordinate",
  navigator: "navigator",
};

// word_agreement bundles several unrelated skills (case, verb number, verb
// gender, ...) as one big card array with a `skill` field per card, one
// mode per skill. Without this, the concept picker would list every card in
// the whole topic regardless of which mode is open — e.g. picking concepts
// for "Числительное + существительное" would also show all the case/verb
// cards that mode never uses. Every other renderer keeps one card set per
// mode already, so this is a no-op for them.
export function getConceptCards(topicRecord, mode) {
  const cards = topicRecord?.cards ?? [];
  if (topicRecord?.meta?.renderer === "word_agreement" && mode?.type) {
    return cards.filter((c) => c.skill === mode.type);
  }
  const taskKind = mode?.type ? TASK_KIND_BY_MODE_TYPE[mode.type] : undefined;
  if (taskKind) {
    return cards.filter((c) => c.taskKind === taskKind);
  }
  return cards;
}

// True when this mode only draws from part of the topic's cards (symmetry_draw's
// taskKind-scoped modes, word_agreement's skill-scoped modes) rather than the
// whole topic. These modes' concept selections must be remembered separately per
// mode - see readModeSelectedConceptIds/writeModeSelectedConceptIds below.
export function isConceptSelectionScopedByMode(topicRecord, mode) {
  if (!mode) return false;
  const allCards = topicRecord?.cards ?? [];
  return getConceptCards(topicRecord, mode).length !== allCards.length;
}

// The student-topic link has a single shared selectedConceptIds array (one
// backend column, one JSON blob) covering every mode of the topic. For a topic
// whose modes share that one array but draw from disjoint card pools (e.g.
// symmetry_draw's mirror/repeat/dictation), confirming a selection in one mode
// would silently overwrite - and appear to ignore - whatever was chosen in
// another. Namespacing entries as "<modeId>::<conceptId>" inside the same flat
// array keeps every mode's choice isolated without any backend schema change.
export function readModeSelectedConceptIds(topicRecord, mode, rawSelectedConceptIds) {
  if (!rawSelectedConceptIds?.length) return null;
  if (!isConceptSelectionScopedByMode(topicRecord, mode)) return rawSelectedConceptIds;
  const prefix = `${mode.id}::`;
  const own = rawSelectedConceptIds
    .filter((id) => id.startsWith(prefix))
    .map((id) => id.slice(prefix.length));
  return own.length ? own : null;
}

export function writeModeSelectedConceptIds(topicRecord, mode, rawSelectedConceptIds, newIdsForMode) {
  if (!isConceptSelectionScopedByMode(topicRecord, mode)) return newIdsForMode;
  const prefix = `${mode.id}::`;
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
