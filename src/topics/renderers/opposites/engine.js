import { shuffle } from "@/shared/utils/shuffle";

function groupByObjectId(cards) {
  const map = new Map();
  for (const card of cards) {
    if (!map.has(card.objectId)) map.set(card.objectId, { left: null, right: null });
    const entry = map.get(card.objectId);
    if (card.pole === "left")       entry.left  = card;
    else if (card.pole === "right") entry.right = card;
  }
  return map;
}

function generateIntroTasks(cards) {
  const byObject = groupByObjectId(cards);
  const tasks = [];
  for (const [, { left, right }] of byObject) {
    if (left)  tasks.push({ type: "intro", card: left });
    if (right) tasks.push({ type: "intro", card: right });
  }
  return tasks;
}

function generatePairComparisonTasks(cards) {
  const byObject = groupByObjectId(cards);
  const tasks = [];
  for (const [, { left, right }] of byObject) {
    if (left && right) tasks.push({ type: "pair_comparison", leftCard: left, rightCard: right });
  }
  return shuffle(tasks);
}

function buildChooseTwoTask(target, sameObjOpposite, allEntries, optionCount) {
  const options = [{ card: target, isTarget: true }, { card: sameObjOpposite, isTarget: false }];
  if (optionCount > 2) {
    const others = shuffle(allEntries.filter(([oid]) => oid !== target.objectId));
    for (const [, { left, right }] of others.slice(0, optionCount - 2)) {
      const distractor = target.pole === "left" ? right : left;
      if (distractor) options.push({ card: distractor, isTarget: false });
    }
  }
  return {
    type:        "choose_two",
    targetPole:  target.pole,
    targetLabel: target.instructionLabel,
    options:     shuffle(options.slice(0, optionCount)),
  };
}

function generateChooseTwoTasks(cards, params) {
  const optionCount = params.optionCount ?? 2;
  const repsPerPair = params.repsPerPair ?? 2;
  const byObject    = groupByObjectId(cards);
  const entries     = [...byObject.entries()];
  const tasks       = [];
  for (const [, { left, right }] of entries) {
    if (!left || !right) continue;
    for (let i = 0; i < repsPerPair; i++) {
      tasks.push(buildChooseTwoTask(left,  right, entries, optionCount));
      tasks.push(buildChooseTwoTask(right, left,  entries, optionCount));
    }
  }
  return shuffle(tasks);
}

function generateSortTask(cards, params) {
  const cardCount  = params.cardCount ?? 4;
  const half       = Math.floor(cardCount / 2);
  const leftCards  = shuffle(cards.filter((c) => c.pole === "left")).slice(0, half);
  const rightCards = shuffle(cards.filter((c) => c.pole === "right")).slice(0, half);
  return [{
    type:       "sort",
    leftLabel:  leftCards[0]?.poleLabel  ?? "левая",
    rightLabel: rightCards[0]?.poleLabel ?? "правая",
    cards: shuffle([
      ...leftCards.map((card)  => ({ card, pole: "left"  })),
      ...rightCards.map((card) => ({ card, pole: "right" })),
    ]),
  }];
}

function generateFindAllTasks(cards, params) {
  const gridSize   = params.gridSize ?? 6;
  const half       = Math.floor(gridSize / 2);
  const leftCards  = shuffle(cards.filter((c) => c.pole === "left"));
  const rightCards = shuffle(cards.filter((c) => c.pole === "right"));
  return [
    ["left",  leftCards,  rightCards],
    ["right", rightCards, leftCards],
  ].map(([targetPole, targets, others]) => {
    const selectedTargets = targets.slice(0, half);
    const selectedOthers  = others.slice(0, gridSize - selectedTargets.length);
    return {
      type:           "find_all",
      targetPole,
      targetLabel:    selectedTargets[0]?.poleLabelPlural ?? targetPole,
      allCards:       shuffle([...selectedTargets, ...selectedOthers]),
      correctCardIds: selectedTargets.map((c) => c.id),
    };
  });
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  switch (mode.type) {
    case "intro":           return generateIntroTasks(cards);
    case "pair_comparison": return generatePairComparisonTasks(cards);
    case "choose_two":      return generateChooseTwoTasks(cards, params);
    case "sort":            return generateSortTask(cards, params);
    case "find_all":        return generateFindAllTasks(cards, params);
    default:                return [];
  }
}
