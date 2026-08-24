// Content for the standalone «Где предмет?» topic.
//
// One relation is always practised at a time.  Every core card has a matched
// contrast photograph of the *same* scene: for «на / под» only the vertical
// relation changes; for «в» the item is either inside the container or beside
// that same container.  This prevents a child from choosing by a familiar
// noun, furniture item, or background instead of by the spatial relation.

export const RELATIONS = [
  { id: "spatial_in", label: "В", relation: "in", shortPhrase: "в" },
  { id: "spatial_on", label: "На", relation: "on", shortPhrase: "на" },
  { id: "spatial_under", label: "Под", relation: "under", shortPhrase: "под" },
];

const RELATION_LABELS = Object.fromEntries(RELATIONS.map(({ relation, label }) => [relation, label]));

function card({ id, conceptId, relation, subject, landmark, phrase, image, contrastImage, phase = "core" }) {
  const model = `${subject} ${phrase}.`;
  return {
    id,
    conceptId,
    label: RELATION_LABELS[relation],
    primary: phase === "core" && id.endsWith("_01"),
    phase,
    relation,
    subject,
    landmark,
    phrase,
    question: `Где ${subject.toLowerCase()}?`,
    recognizePrompt: `Покажи: ${subject.toLowerCase()} ${phrase}.`,
    model,
    image,
    contrastImage,
  };
}

export const CORE_CARDS = [
  // «В»: two cards with the same box isolate a change of object, then the
  // container changes one variable at a time.  The contrast always remains a
  // non-taught «рядом с», never another untaught grammatical construction.
  card({
    id: "spatial_in_01", conceptId: "spatial_in", relation: "in",
    subject: "Мяч", landmark: "коробке", phrase: "в коробке",
    image: "media/core-box-ball-in.png", contrastImage: "media/core-box-ball-out.png",
  }),
  card({
    id: "spatial_in_02", conceptId: "spatial_in", relation: "in",
    subject: "Машинка", landmark: "коробке", phrase: "в коробке",
    image: "media/core-box-car-in.png", contrastImage: "media/core-box-car-out.png",
  }),
  card({
    id: "spatial_in_03", conceptId: "spatial_in", relation: "in",
    subject: "Мяч", landmark: "корзине", phrase: "в корзине",
    image: "media/core-basket-ball-in.png", contrastImage: "media/core-basket-ball-out.png",
  }),
  card({
    id: "spatial_in_04", conceptId: "spatial_in", relation: "in",
    subject: "Кубик", landmark: "рюкзаке", phrase: "в рюкзаке",
    image: "media/core-backpack-cube-in.png", contrastImage: "media/core-backpack-cube-out.png",
  }),
  card({
    id: "spatial_in_05", conceptId: "spatial_in", relation: "in",
    subject: "Мишка", landmark: "домике", phrase: "в домике",
    image: "media/core-house-bear-in.png", contrastImage: "media/core-house-bear-out.png",
  }),

  // «На / под»: matching pairs share the same scene, object and landmark.
  card({
    id: "spatial_on_01", conceptId: "spatial_on", relation: "on",
    subject: "Мяч", landmark: "столе", phrase: "на столе",
    image: "media/core-table-ball-on.png", contrastImage: "media/core-table-ball-under.png",
  }),
  card({
    id: "spatial_on_02", conceptId: "spatial_on", relation: "on",
    subject: "Машинка", landmark: "столе", phrase: "на столе",
    image: "media/core-table-car-on.png", contrastImage: "media/core-table-car-under.png",
  }),
  card({
    id: "spatial_on_03", conceptId: "spatial_on", relation: "on",
    subject: "Мяч", landmark: "стуле", phrase: "на стуле",
    image: "media/core-chair-ball-on.png", contrastImage: "media/core-chair-ball-under.png",
  }),
  card({
    id: "spatial_on_04", conceptId: "spatial_on", relation: "on",
    subject: "Кубик", landmark: "кровати", phrase: "на кровати",
    image: "media/core-bed-cube-on.png", contrastImage: "media/core-bed-cube-under.png",
  }),
  card({
    id: "spatial_on_05", conceptId: "spatial_on", relation: "on",
    subject: "Мишка", landmark: "столе", phrase: "на столе",
    image: "media/core-bench-bear-on.png", contrastImage: "media/core-bench-bear-under.png",
  }),
  card({
    id: "spatial_under_01", conceptId: "spatial_under", relation: "under",
    subject: "Мяч", landmark: "столом", phrase: "под столом",
    image: "media/core-table-ball-under.png", contrastImage: "media/core-table-ball-on.png",
  }),
  card({
    id: "spatial_under_02", conceptId: "spatial_under", relation: "under",
    subject: "Машинка", landmark: "столом", phrase: "под столом",
    image: "media/core-table-car-under.png", contrastImage: "media/core-table-car-on.png",
  }),
  card({
    id: "spatial_under_03", conceptId: "spatial_under", relation: "under",
    subject: "Мяч", landmark: "стулом", phrase: "под стулом",
    image: "media/core-chair-ball-under.png", contrastImage: "media/core-chair-ball-on.png",
  }),
  card({
    id: "spatial_under_04", conceptId: "spatial_under", relation: "under",
    subject: "Кубик", landmark: "кроватью", phrase: "под кроватью",
    image: "media/core-bed-cube-under.png", contrastImage: "media/core-bed-cube-on.png",
  }),
  card({
    id: "spatial_under_05", conceptId: "spatial_under", relation: "under",
    subject: "Мишка", landmark: "столом", phrase: "под столом",
    image: "media/core-bench-bear-under.png", contrastImage: "media/core-bench-bear-on.png",
  }),
];

// These photos are not used in the other modes.  The child meets the same
// familiar words in a new visual instance only after work with the core set.
// This makes the transfer mode a genuine check of the spatial relation rather
// than recognition of a memorised photograph.
export const TRANSFER_CARDS = [
  card({
    id: "spatial_in_transfer_01", conceptId: "spatial_in", relation: "in",
    subject: "Мяч", landmark: "коробке", phrase: "в коробке", phase: "transfer",
    image: "media/transfer-box-ball-in.png", contrastImage: "media/transfer-box-ball-out.png",
  }),
  card({
    id: "spatial_in_transfer_02", conceptId: "spatial_in", relation: "in",
    subject: "Машинка", landmark: "коробке", phrase: "в коробке", phase: "transfer",
    image: "media/transfer-box-car-in.png", contrastImage: "media/transfer-box-car-out.png",
  }),
  card({
    id: "spatial_in_transfer_03", conceptId: "spatial_in", relation: "in",
    subject: "Мяч", landmark: "корзине", phrase: "в корзине", phase: "transfer",
    image: "media/transfer-basket-ball-in.png", contrastImage: "media/transfer-basket-ball-out.png",
  }),
  card({
    id: "spatial_in_transfer_04", conceptId: "spatial_in", relation: "in",
    subject: "Кубик", landmark: "рюкзаке", phrase: "в рюкзаке", phase: "transfer",
    image: "media/transfer-backpack-cube-in.png", contrastImage: "media/transfer-backpack-cube-out.png",
  }),
  card({
    id: "spatial_in_transfer_05", conceptId: "spatial_in", relation: "in",
    subject: "Мишка", landmark: "домике", phrase: "в домике", phase: "transfer",
    image: "media/transfer-house-bear-in.png", contrastImage: "media/transfer-house-bear-out.png",
  }),

  card({
    id: "spatial_on_transfer_01", conceptId: "spatial_on", relation: "on",
    subject: "Мяч", landmark: "столе", phrase: "на столе", phase: "transfer",
    image: "media/transfer-table-ball-on.png", contrastImage: "media/transfer-table-ball-under.png",
  }),
  card({
    id: "spatial_on_transfer_02", conceptId: "spatial_on", relation: "on",
    subject: "Машинка", landmark: "столе", phrase: "на столе", phase: "transfer",
    image: "media/transfer-table-car-on.png", contrastImage: "media/transfer-table-car-under.png",
  }),
  card({
    id: "spatial_on_transfer_03", conceptId: "spatial_on", relation: "on",
    subject: "Мяч", landmark: "стуле", phrase: "на стуле", phase: "transfer",
    image: "media/transfer-chair-ball-on.png", contrastImage: "media/transfer-chair-ball-under.png",
  }),
  card({
    id: "spatial_on_transfer_04", conceptId: "spatial_on", relation: "on",
    subject: "Кубик", landmark: "кровати", phrase: "на кровати", phase: "transfer",
    image: "media/transfer-bed-cube-on.png", contrastImage: "media/transfer-bed-cube-under.png",
  }),
  card({
    id: "spatial_on_transfer_05", conceptId: "spatial_on", relation: "on",
    subject: "Мишка", landmark: "скамейке", phrase: "на скамейке", phase: "transfer",
    image: "media/transfer-bench-bear-on.png", contrastImage: "media/transfer-bench-bear-under.png",
  }),
  card({
    id: "spatial_under_transfer_01", conceptId: "spatial_under", relation: "under",
    subject: "Мяч", landmark: "столом", phrase: "под столом", phase: "transfer",
    image: "media/transfer-table-ball-under.png", contrastImage: "media/transfer-table-ball-on.png",
  }),
  card({
    id: "spatial_under_transfer_02", conceptId: "spatial_under", relation: "under",
    subject: "Машинка", landmark: "столом", phrase: "под столом", phase: "transfer",
    image: "media/transfer-table-car-under.png", contrastImage: "media/transfer-table-car-on.png",
  }),
  card({
    id: "spatial_under_transfer_03", conceptId: "spatial_under", relation: "under",
    subject: "Мяч", landmark: "стулом", phrase: "под стулом", phase: "transfer",
    image: "media/transfer-chair-ball-under.png", contrastImage: "media/transfer-chair-ball-on.png",
  }),
  card({
    id: "spatial_under_transfer_04", conceptId: "spatial_under", relation: "under",
    subject: "Кубик", landmark: "кроватью", phrase: "под кроватью", phase: "transfer",
    image: "media/transfer-bed-cube-under.png", contrastImage: "media/transfer-bed-cube-on.png",
  }),
  card({
    id: "spatial_under_transfer_05", conceptId: "spatial_under", relation: "under",
    subject: "Мишка", landmark: "скамейкой", phrase: "под скамейкой", phase: "transfer",
    image: "media/transfer-bench-bear-under.png", contrastImage: "media/transfer-bench-bear-on.png",
  }),
];

export const ALL_CARDS = [...CORE_CARDS, ...TRANSFER_CARDS];
