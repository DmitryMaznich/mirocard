const RELATION_BY_CONCEPT = {
  spatial_in: "in",
  spatial_on: "on",
  spatial_under: "under",
};
const RELATION_IDS = Object.keys(RELATION_BY_CONCEPT);

function requestedRelation(params) {
  return RELATION_BY_CONCEPT[params?.relation] ?? "in";
}

function requestedRelations(params) {
  const selected = Array.isArray(params?.relations)
    ? params.relations.filter((id) => RELATION_BY_CONCEPT[id])
    : [];
  // An empty enum_multi selection means «Все».  A stale one-item setting
  // should never turn «Микс» into a disguised single-preposition drill.
  return selected.length >= 2 ? selected.map((id) => RELATION_BY_CONCEPT[id]) : RELATION_IDS.map((id) => RELATION_BY_CONCEPT[id]);
}

function relationCards(cards, relation, phase = "core") {
  return cards.filter((card) => card.relation === relation && (card.phase ?? "core") === phase);
}

function interleaveRelations(cards, relations) {
  const buckets = new Map(relations.map((relation) => [relation, relationCards(cards, relation)]));
  const mixed = [];
  let previousRelation = null;

  while ([...buckets.values()].some((bucket) => bucket.length > 0)) {
    const available = [...buckets.entries()]
      .filter(([, bucket]) => bucket.length > 0)
      .map(([relation]) => relation);
    const candidates = available.filter((relation) => relation !== previousRelation);
    const relation = (candidates.length ? candidates : available)[Math.floor(Math.random() * (candidates.length || available.length))];
    mixed.push(buckets.get(relation).shift());
    previousRelation = relation;
  }

  return mixed;
}

function buildIntroductionTasks(cards, params) {
  const relation = requestedRelation(params);
  return relationCards(cards, relation).map((card) => ({
    type: "spatial_introduction",
    conceptId: card.conceptId,
    card,
    modelFirst: params?.modelTiming === "model_first",
  }));
}

function buildRecognitionTasks(cards, params, { type = "spatial_recognize", phase = "core", mixed = false } = {}) {
  const sourceCards = mixed
    ? interleaveRelations(cards.filter((card) => (card.phase ?? "core") === phase), requestedRelations(params))
    : relationCards(cards, requestedRelation(params), phase);

  return sourceCards.map((card, index) => {
    const target = { id: "target", image: card.image, isTarget: true };
    const contrast = { id: "contrast", image: card.contrastImage, isTarget: false };
    return {
      type,
      conceptId: card.conceptId,
      card,
      // The two fixed slots remain predictable.  Only their contents swap,
      // preventing a left/right tapping habit without a noisy re-layout.
      options: index % 2 === 0 ? [target, contrast] : [contrast, target],
      showInstructionText: params?.showInstructionText === true,
    };
  });
}

function buildResponseTasks(cards, params) {
  const relation = requestedRelation(params);
  return relationCards(cards, relation).map((card) => ({
    type: "spatial_respond",
    conceptId: card.conceptId,
    card,
  }));
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  switch (mode?.type ?? mode?.id) {
    case "spatial_introduction": return buildIntroductionTasks(cards, params);
    case "spatial_recognize": return buildRecognitionTasks(cards, params);
    case "spatial_respond": return buildResponseTasks(cards, params);
    case "spatial_transfer": return buildRecognitionTasks(cards, params, { type: "spatial_transfer", phase: "transfer" });
    case "spatial_mixed": return buildRecognitionTasks(cards, params, { type: "spatial_mixed", mixed: true });
    default: return [];
  }
}
