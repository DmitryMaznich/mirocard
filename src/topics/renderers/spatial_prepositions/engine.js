const RELATION_BY_CONCEPT = {
  spatial_in: "in",
  spatial_near: "near",
  spatial_on: "on",
  spatial_under: "under",
};
const RELATION_IDS = Object.keys(RELATION_BY_CONCEPT);

function requestedRelations(params) {
  const selected = Array.isArray(params?.relations)
    ? params.relations.filter((id) => RELATION_BY_CONCEPT[id])
    : [];
  // An empty enum_multi selection means «Все»; a single selected item is a
  // valid focused session.
  return selected.length ? selected.map((id) => RELATION_BY_CONCEPT[id]) : RELATION_IDS.map((id) => RELATION_BY_CONCEPT[id]);
}

function relationCards(cards, relation) {
  // `selectedCards` has already chosen the teaching phase. Filtering by the
  // default core phase again here made every transfer bucket empty.
  return cards.filter((card) => card.relation === relation);
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
    const eligible = candidates.length ? candidates : available;
    // Take a relation with the largest remaining pool.  Choosing an arbitrary
    // different relation can exhaust the small pools first and leave two cards
    // from the same relation adjacent even when a clean alternation is possible.
    const largestPool = Math.max(...eligible.map((relation) => buckets.get(relation).length));
    const balanced = eligible.filter((relation) => buckets.get(relation).length === largestPool);
    const relation = balanced[Math.floor(Math.random() * balanced.length)];
    mixed.push(buckets.get(relation).shift());
    previousRelation = relation;
  }

  return mixed;
}

function selectedCards(cards, params, phase = "core") {
  return interleaveRelations(
    cards.filter((card) => (card.phase ?? "core") === phase),
    requestedRelations(params),
  );
}

function buildIntroductionTasks(cards, params) {
  return selectedCards(cards, params).map((card) => ({
    type: "spatial_introduction",
    conceptId: card.conceptId,
    card,
    modelFirst: params?.modelTiming === "model_first",
  }));
}

function buildRecognitionTasks(cards, params, { type = "spatial_recognize", phase = "core" } = {}) {
  const sourceCards = selectedCards(cards, params, phase);

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
    };
  });
}

function rotateOptions(options, index) {
  const offset = index % options.length;
  return offset ? [...options.slice(-offset), ...options.slice(0, -offset)] : options;
}

function responseDistractor(card, cards, relation) {
  const phase = card.phase ?? "core";
  return cards.find((candidate) => (
    candidate.relation === relation
    && candidate.subject === card.subject
    && (candidate.phase ?? "core") === phase
  )) ?? cards.find((candidate) => (
    candidate.relation === relation && (candidate.phase ?? "core") === phase
  ));
}

function buildResponseTasks(cards, params) {
  const optionCount = Number(params?.answerOptions) === 4 ? 4 : 2;
  return selectedCards(cards, params).map((card, index) => {
    // Use the paired scene as the distractor.  The child therefore chooses
    // between two verbal descriptions of the same object and setting, rather
    // than being led by a change of object or background.
    const contrastCard = cards.find((candidate) => candidate.image === card.contrastImage);
    if (!contrastCard) throw new Error(`Missing paired response card for ${card.id}`);

    const target = { id: "target", text: card.phrase, isTarget: true };
    const contrast = { id: "contrast", text: contrastCard.phrase, isTarget: false };
    const options = [target, contrast];

    if (optionCount === 4) {
      // Two more answers complete the set of relations.  Prefer phrases with
      // the same subject and phase so the added difficulty is in recognising
      // the preposition, not in changing the pictured object.
      for (const relation of Object.values(RELATION_BY_CONCEPT)) {
        if (relation === card.relation || relation === contrastCard.relation) continue;
        const distractor = responseDistractor(card, cards, relation);
        if (!distractor) throw new Error(`Missing ${relation} response distractor for ${card.id}`);
        options.push({ id: `relation-${relation}`, text: distractor.phrase, isTarget: false });
      }
    }

    return {
      type: "spatial_respond",
      conceptId: card.conceptId,
      card,
      // Fixed slots keep the layout calm, while the contents rotate so the
      // answer cannot become a left/right tapping habit.
      options: rotateOptions(options, index),
    };
  });
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  switch (mode?.type ?? mode?.id) {
    case "spatial_introduction": return buildIntroductionTasks(cards, params);
    case "spatial_recognize": return buildRecognitionTasks(cards, params);
    case "spatial_respond": return buildResponseTasks(cards, params);
    case "spatial_transfer": return buildRecognitionTasks(cards, params, { type: "spatial_transfer", phase: "transfer" });
    default: return [];
  }
}
