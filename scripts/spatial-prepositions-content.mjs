// Content for the standalone «Где предмет?» topic.
//
// A single relation is practised at a time until it is ready for the separate
// mixed drill. Every core card has a matched contrast photograph of the same
// scene: for «на / под» only the vertical relation changes; for «в / рядом
// с» the item is either inside the container or beside that same container.
// Every photograph is a teachable relation rather than a throwaway distractor.

export const RELATIONS = [
  { id: "spatial_in", label: "В", relation: "in", shortPhrase: "в" },
  { id: "spatial_near", label: "Рядом с", relation: "near", shortPhrase: "рядом с" },
  { id: "spatial_on", label: "На", relation: "on", shortPhrase: "на" },
  { id: "spatial_under", label: "Под", relation: "under", shortPhrase: "под" },
];

const RELATION_LABELS = Object.fromEntries(RELATIONS.map(({ relation, label }) => [relation, label]));

const SUBJECT_AUDIO_IDS = {
  "Мяч": "ball",
  "Машинка": "car",
  "Кубик": "cube",
  "Мишка": "bear",
};

// The same spoken construction is deliberately shared by matching core and
// transfer cards.  This keeps the downloaded deck compact without changing
// the language model the child hears.
const CONSTRUCTION_AUDIO_IDS = {
  "Мяч|в коробке": "ball-in-box",
  "Машинка|в коробке": "car-in-box",
  "Мяч|в корзине": "ball-in-basket",
  "Кубик|в рюкзаке": "cube-in-backpack",
  "Мишка|в домике": "bear-in-house",
  "Мяч|рядом с коробкой": "ball-near-box",
  "Машинка|рядом с коробкой": "car-near-box",
  "Мяч|рядом с корзиной": "ball-near-basket",
  "Кубик|рядом с рюкзаком": "cube-near-backpack",
  "Мишка|рядом с домиком": "bear-near-house",
  "Мяч|на столе": "ball-on-table",
  "Машинка|на столе": "car-on-table",
  "Мяч|на стуле": "ball-on-chair",
  "Кубик|на кровати": "cube-on-bed",
  "Мишка|на столе": "bear-on-table",
  "Мяч|под столом": "ball-under-table",
  "Машинка|под столом": "car-under-table",
  "Мяч|под стулом": "ball-under-chair",
  "Кубик|под кроватью": "cube-under-bed",
  "Мишка|под столом": "bear-under-table",
  "Мишка|на скамейке": "bear-on-bench",
  "Мишка|под скамейкой": "bear-under-bench",
};

function toWebp(path) {
  return path.replace(/\.png$/i, ".webp");
}

function card({ id, conceptId, relation, subject, landmark, phrase, image, contrastImage, phase = "core" }) {
  const model = `${subject} ${phrase}.`;
  const subjectAudioId = SUBJECT_AUDIO_IDS[subject];
  const constructionAudioId = CONSTRUCTION_AUDIO_IDS[`${subject}|${phrase}`];
  if (!subjectAudioId || !constructionAudioId) {
    throw new Error(`Missing audio identifiers for ${subject} ${phrase}`);
  }
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
    questionAudio: `audio/q-${subjectAudioId}.mp3`,
    modelAudio: `audio/m-${constructionAudioId}.mp3`,
    recognizeAudio: `audio/r-${constructionAudioId}.mp3`,
    image: toWebp(image),
    contrastImage: toWebp(contrastImage),
  };
}

// The former contrast images for «в» are the complete, paired core of
// «рядом с».  The same is true for their new-picture counterparts below.
const NEAR_VARIANTS = [
  { number: "01", subject: "Мяч", landmark: "коробкой", phrase: "рядом с коробкой", coreImage: "media/core-box-ball-out.png", coreContrast: "media/core-box-ball-in.png", transferImage: "media/transfer-box-ball-out.png", transferContrast: "media/transfer-box-ball-in.png" },
  { number: "02", subject: "Машинка", landmark: "коробкой", phrase: "рядом с коробкой", coreImage: "media/core-box-car-out.png", coreContrast: "media/core-box-car-in.png", transferImage: "media/transfer-box-car-out.png", transferContrast: "media/transfer-box-car-in.png" },
  { number: "03", subject: "Мяч", landmark: "корзиной", phrase: "рядом с корзиной", coreImage: "media/core-basket-ball-out.png", coreContrast: "media/core-basket-ball-in.png", transferImage: "media/transfer-basket-ball-out.png", transferContrast: "media/transfer-basket-ball-in.png" },
  { number: "04", subject: "Кубик", landmark: "рюкзаком", phrase: "рядом с рюкзаком", coreImage: "media/core-backpack-cube-out.png", coreContrast: "media/core-backpack-cube-in.png", transferImage: "media/transfer-backpack-cube-out.png", transferContrast: "media/transfer-backpack-cube-in.png" },
  { number: "05", subject: "Мишка", landmark: "домиком", phrase: "рядом с домиком", coreImage: "media/core-house-bear-out.png", coreContrast: "media/core-house-bear-in.png", transferImage: "media/transfer-house-bear-out.png", transferContrast: "media/transfer-house-bear-in.png" },
];

export const CORE_NEAR_CARDS = NEAR_VARIANTS.map(({ number, subject, landmark, phrase, coreImage: image, coreContrast: contrastImage }) => card({
  id: `spatial_near_${number}`,
  conceptId: "spatial_near",
  relation: "near",
  subject,
  landmark,
  phrase,
  image,
  contrastImage,
}));

export const TRANSFER_NEAR_CARDS = NEAR_VARIANTS.map(({ number, subject, landmark, phrase, transferImage: image, transferContrast: contrastImage }) => card({
  id: `spatial_near_transfer_${number}`,
  conceptId: "spatial_near",
  relation: "near",
  subject,
  landmark,
  phrase,
  image,
  contrastImage,
  phase: "transfer",
}));

export const CORE_CARDS = [
  // «В»: two cards with the same box isolate a change of object, then the
  // container changes one variable at a time.  Their paired «рядом с» photos
  // are active cards in the same topic, not unintroduced distractors.
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

  ...CORE_NEAR_CARDS,

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

  ...TRANSFER_NEAR_CARDS,

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
