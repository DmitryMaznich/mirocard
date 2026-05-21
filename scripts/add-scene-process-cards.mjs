// scripts/add-scene-process-cards.mjs
// Adds 12 scene_process cards to Cardgen Studio cards.json
import { readFileSync, writeFileSync } from "node:fs";

const CARDS_JSON = "C:/Users/dmazn/Projects/Mirocard/cardgen-studio/projects/tools_functions/cards.json";

const STYLE = "high-quality photorealistic educational scene photo, natural soft lighting, sharp focus, true-to-life colors, no filters, professional educational photography style, child-friendly, clean light background";
const COMP  = "square 1:1 composition, no text, no watermark";

const PROCESS_CARDS = [
  {
    id: "hammer_scene_process",
    label: { ru: "Молоток — процесс", en: "Hammer — process" },
    subject: "a hand gripping a hammer mid-swing, actively driving a nail into a wooden board, dynamic action moment",
    semantic: { group1: "striking", group2: "wood", group3: "fastening" },
  },
  {
    id: "screwdriver_scene_process",
    label: { ru: "Отвёртка — процесс", en: "Screwdriver — process" },
    subject: "a hand holding a screwdriver, turning it to drive a screw into a wooden plank, action visible",
    semantic: { group1: "turning", group2: "wood", group3: "fastening" },
  },
  {
    id: "drill_scene_process",
    label: { ru: "Дрель — процесс", en: "Drill — process" },
    subject: "hands holding a power drill pressed against a concrete wall, actively drilling, dust particles visible",
    semantic: { group1: "drilling", group2: "concrete", group3: "boring" },
  },
  {
    id: "handsaw_scene_process",
    label: { ru: "Пила — процесс", en: "Handsaw — process" },
    subject: "a hand holding a hand saw, actively cutting through a wooden plank, sawdust visible at the cut",
    semantic: { group1: "cutting", group2: "wood", group3: "sawing" },
  },
  {
    id: "wrench_scene_process",
    label: { ru: "Гаечный ключ — процесс", en: "Wrench — process" },
    subject: "a hand holding an open-end wrench, actively tightening a nut on a bolt",
    semantic: { group1: "turning", group2: "metal", group3: "fastening" },
  },
  {
    id: "pliers_scene_process",
    label: { ru: "Пассатижи — процесс", en: "Pliers — process" },
    subject: "a hand gripping pliers, actively bending a metal wire, the bend in progress",
    semantic: { group1: "gripping", group2: "metal", group3: "bending" },
  },
  {
    id: "wire_cutters_scene_process",
    label: { ru: "Кусачки — процесс", en: "Wire cutters — process" },
    subject: "a hand holding wire cutters at the exact moment of cutting through a metal wire",
    semantic: { group1: "cutting", group2: "metal", group3: "cutting" },
  },
  {
    id: "tape_measure_scene_process",
    label: { ru: "Рулетка — процесс", en: "Tape measure — process" },
    subject: "a hand extending a tape measure along the length of a wooden board, actively measuring",
    semantic: { group1: "measuring", group2: "wood", group3: "measuring" },
  },
  {
    id: "paintbrush_scene_process",
    label: { ru: "Кисточка — процесс", en: "Paintbrush — process" },
    subject: "a hand holding a paint brush, actively painting a wall with blue paint, mid-stroke visible",
    semantic: { group1: "painting", group2: "wall", group3: "coating" },
  },
  {
    id: "spatula_scene_process",
    label: { ru: "Шпатель — процесс", en: "Spatula — process" },
    subject: "a hand holding a spatula, actively spreading putty over a crack in a wall, smooth motion",
    semantic: { group1: "spreading", group2: "wall", group3: "filling" },
  },
  {
    id: "drill_bit_scene_process",
    label: { ru: "Сверло — процесс", en: "Drill bit — process" },
    subject: "a power drill with a drill bit actively boring into a small wooden block, sawdust flying out",
    semantic: { group1: "drilling", group2: "wood", group3: "boring" },
  },
  {
    id: "ruler_scene_process",
    label: { ru: "Линейка — процесс", en: "Ruler — process" },
    subject: "a hand holding a pencil against a wooden ruler, drawing a straight line on white paper, motion visible",
    semantic: { group1: "measuring", group2: "paper", group3: "drawing" },
  },
];

const data = JSON.parse(readFileSync(CARDS_JSON, "utf8"));

// Remove any existing scene_process cards (idempotent)
data.cards = data.cards.filter(c => !c.id.endsWith("_scene_process"));

// Insert each scene_process card after its corresponding scene_before card
for (const pc of PROCESS_CARDS) {
  const prompt = `${STYLE}, ${pc.subject}, ${COMP}`;
  const card = {
    id: pc.id,
    label: pc.label,
    subject: pc.subject,
    prompt,
    status: "pending",
    filename: `${pc.id}.webp`,
    notes: "",
    category: "tools",
    tags: ["tools", "scene_process"],
    enabled: true,
    semantic: pc.semantic,
  };

  // Insert after scene_before of same concept
  const conceptId = pc.id.replace("_scene_process", "");
  const afterId = `${conceptId}_scene_before`;
  const idx = data.cards.findIndex(c => c.id === afterId);
  if (idx >= 0) {
    data.cards.splice(idx + 1, 0, card);
  } else {
    data.cards.push(card);
  }
}

writeFileSync(CARDS_JSON, JSON.stringify(data, null, 2), "utf8");

const pending = data.cards.filter(c => c.status === "pending").length;
console.log(`✅ cards.json обновлён. Pending карточек: ${pending}`);
console.log(`   Всего карточек: ${data.cards.length}`);
