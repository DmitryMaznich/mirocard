const RELATION_BY_CONCEPT = {
  spatial_in: "in",
  spatial_on: "on",
  spatial_under: "under",
};

function requestedRelation(params) {
  return RELATION_BY_CONCEPT[params?.relation] ?? "in";
}

function requestedCount(params, fallback) {
  const value = Number(params?.cardCount);
  return [2, 3, 5].includes(value) ? value : fallback;
}

function relationCards(cards, relation, phase = "core") {
  return cards.filter((card) => card.relation === relation && (card.phase ?? "core") === phase);
}

function takeInTeachingOrder(cards, count) {
  return cards.slice(0, Math.min(count, cards.length));
}

function buildIntroductionTasks(cards, params) {
  const relation = requestedRelation(params);
  return takeInTeachingOrder(relationCards(cards, relation), requestedCount(params, 3)).map((card) => ({
    type: "spatial_introduction",
    conceptId: card.conceptId,
    card,
    modelFirst: params?.modelTiming === "model_first",
  }));
}

function buildRecognitionTasks(cards, params, type = "spatial_recognize", phase = "core") {
  const relation = requestedRelation(params);
  return takeInTeachingOrder(relationCards(cards, relation, phase), requestedCount(params, 5)).map((card, index) => {
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
  return takeInTeachingOrder(relationCards(cards, relation), requestedCount(params, 3)).map((card) => ({
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
    case "spatial_transfer": return buildRecognitionTasks(cards, params, "spatial_transfer", "transfer");
    default: return [];
  }
}
