import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const dadBestImage = readFileSync(new URL("./assets/reading_dad_poems/dad_best.webp", import.meta.url));
const momLoveImage = readFileSync(new URL("./assets/reading_dad_poems/mom_love.webp", import.meta.url));

const alinaPath = fileURLToPath(new URL("../Alina.png", import.meta.url));
const polinaPath = fileURLToPath(new URL("../Polina.png", import.meta.url));

// Standalone photo crops — no shared canvas/background. Positioning into
// screen corners happens in CSS (.reading-corner-photo), using the full
// available illustration width instead of a fixed-size composed image.
async function buildSisterPhoto(path) {
  return sharp(path)
    .resize(280, 360, { fit: "cover", position: "top" })
    .webp({ quality: 90 })
    .toBuffer();
}

const [alinaPhoto, polinaPhoto] = await Promise.all([buildSisterPhoto(alinaPath), buildSisterPhoto(polinaPath)]);

const familySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <circle cx="120" cy="120" r="116" fill="#fef6f0" stroke="#f0d8c8" stroke-width="3"/>
  <ellipse cx="120" cy="202" rx="86" ry="12" fill="#b8dc90" opacity="0.55"/>
  <!-- Dad left -->
  <rect x="46" y="118" width="30" height="54" rx="8" fill="#3c6abf"/>
  <circle cx="61" cy="103" r="18" fill="#f5c896"/>
  <path d="M 43 99 Q 61 77 79 99 L 79 94 Q 61 73 43 94 Z" fill="#5a3010"/>
  <!-- Mom right -->
  <path d="M 153 122 Q 165 118 178 122 L 183 178 Q 165 181 147 178 Z" fill="#e8609a"/>
  <circle cx="165" cy="107" r="16" fill="#f5c896"/>
  <path d="M 149 104 Q 165 84 181 104 L 183 128 Q 165 136 147 128 Z" fill="#8b4513"/>
  <!-- Child 1 -->
  <rect x="95" y="134" width="22" height="40" rx="6" fill="#5cb870"/>
  <circle cx="106" cy="120" r="13" fill="#f5d0a0"/>
  <ellipse cx="96" cy="112" rx="5" ry="4" fill="#8b4513"/>
  <ellipse cx="116" cy="112" rx="5" ry="4" fill="#8b4513"/>
  <!-- Child 2 -->
  <rect x="122" y="137" width="20" height="36" rx="6" fill="#e07830"/>
  <circle cx="132" cy="124" r="12" fill="#f5d0a0"/>
  <!-- Heart -->
  <path d="M 120 54 C 115 46 102 42 96 52 C 90 60 92 70 100 76 L 120 93 L 140 76 C 148 70 150 60 144 52 C 138 42 125 46 120 54 Z" fill="#e83060" opacity="0.9"/>
  <circle cx="55" cy="62" r="3" fill="#ffd700" opacity="0.8"/>
  <circle cx="185" cy="67" r="3" fill="#ffd700" opacity="0.8"/>
  <circle cx="45" cy="82" r="2" fill="#ffd700" opacity="0.6"/>
  <circle cx="196" cy="82" r="2" fill="#ffd700" opacity="0.6"/>
</svg>`;

const manifest = {
  meta: {
    id: "reading_dad_poems",
    version: "1.0.20",
    minAppVersion: "1.0.2",
    language: "ru",
    renderer: "reading",
    avatar: "media/dad_best.webp",
    title: { ru: "Чтение: Стихи", en: "Reading: Poems" },
    description: {
      ru: "Совместное чтение, вопросы по смыслу и сборка стихотворения из слов.",
      en: "Shared reading, comprehension questions, and poem assembly.",
    },
    about: {
      ru: [
        "Тема предназначена для активной работы логопеда с ребёнком.",
        "Озвучка не является основным сценарием: специалист сам ведёт темп, интонацию и подсказки.",
        "Режим сборки подходит для заучивания стихотворения.",
      ],
      en: ["Designed for therapist-led reading sessions."],
    },
    conceptCount: 4,
    sessionConfig: { maxSize: 8 },
  },
  modes: [
    { id: "read_text", requirePin: false },
    { id: "understand_text", requirePin: false },
    { id: "assemble_text", requirePin: false },
    { id: "follow_instruction", requirePin: false },
  ],
  cards: [],
  texts: [
    {
      id: "dad_best",
      kind: "poem",
      title: { ru: "Наш папа", en: "Our Dad" },
      image: "media/dad_best.webp",
      level: 1,
      lines: [
        { id: "l1", text: "Кто на свете лучше всех?" },
        { id: "l2", text: "Дарит счастье, дарит смех!" },
        { id: "l3", text: "Дарит мне игрушки," },
        { id: "l4", text: "Покупает плюшки!" },
        { id: "l5", text: "Возит в отпуск и на пляж..." },
        { id: "l6", text: "Ну конечно, ПАПА НАШ!" },
      ],
      questions: [
        {
          id: "q_about",
          prompt: "О ком это стихотворение?",
          answer: ["папа", "о папе"],
          supportLineIds: ["l6"],
        },
        {
          id: "q_best_who",
          prompt: "Кто на свете лучше всех?",
          answer: ["папа", "папа наш"],
          supportLineIds: ["l1", "l6"],
        },
        {
          id: "q_better_than",
          prompt: "Папа лучше чем кто?",
          answer: ["лучше всех"],
          supportLineIds: ["l1"],
        },
        {
          id: "q_why_best",
          prompt: "Почему папа лучший?",
          answer: ["дарит счастье", "дарит смех", "дарит игрушки", "покупает плюшки", "возит в отпуск", "возит на пляж"],
          supportLineIds: ["l2", "l3", "l4", "l5"],
        },
        {
          id: "q_gives",
          prompt: "Что папа дарит?",
          answer: ["счастье", "смех", "игрушки"],
          supportLineIds: ["l2", "l3"],
        },
        {
          id: "q_gives_besides_toys",
          prompt: "Что папа дарит, кроме игрушек?",
          answer: ["счастье", "смех"],
          supportLineIds: ["l2", "l3"],
        },
        {
          id: "q_to_whom",
          prompt: "Кому папа дарит игрушки?",
          answer: ["мне", "ребёнку"],
          supportLineIds: ["l3"],
        },
        {
          id: "q_buys",
          prompt: "Что папа покупает?",
          answer: ["плюшки"],
          supportLineIds: ["l4"],
        },
        {
          id: "q_edible",
          prompt: "Что в стихотворении можно съесть?",
          answer: ["плюшки"],
          supportLineIds: ["l4"],
        },
        {
          id: "q_where",
          prompt: "Куда папа возит?",
          answer: ["в отпуск", "на пляж"],
          supportLineIds: ["l5"],
        },
        {
          id: "q_rest_place",
          prompt: "Где можно отдыхать с папой?",
          answer: ["в отпуске", "на пляже"],
          supportLineIds: ["l5"],
        },
        {
          id: "q_actions",
          prompt: "Что папа делает для ребёнка?",
          answer: ["дарит", "покупает", "возит"],
          supportLineIds: ["l2", "l3", "l4", "l5"],
        },
        {
          id: "q_mood",
          prompt: "Какое настроение дарит папа?",
          answer: ["счастье", "смех", "радость"],
          supportLineIds: ["l2"],
        },
        {
          id: "q_what_kind",
          prompt: "Какой папа в этом стихотворении?",
          answer: ["добрый", "весёлый", "заботливый", "хороший"],
          supportLineIds: ["l2", "l3", "l4", "l5", "l6"],
        },
        {
          id: "q_laugh_or_sad",
          prompt: "Папа дарит грусть или смех?",
          answer: ["смех"],
          supportLineIds: ["l2"],
        },
        {
          id: "q_our_dad",
          prompt: "Что значит «ПАПА НАШ»?",
          answer: ["мой папа", "наш папа", "папа ребёнка"],
          supportLineIds: ["l6"],
        },
      ],
    },
    {
      id: "mom_love",
      kind: "poem",
      title: { ru: "Любимая мама", en: "My Loving Mom" },
      image: "media/mom_love.webp",
      level: 1,
      lines: [
        { id: "l1", text: "Маму очень я люблю!" },
        { id: "l2", text: "Я ей радость подарю," },
        { id: "l3", text: "Буду дома помогать" },
        { id: "l4", text: "И пятёрки получать!" },
      ],
      questions: [
        {
          id: "q_about",
          prompt: "О ком это стихотворение?",
          answer: ["мама", "о маме"],
          supportLineIds: ["l1"],
        },
        {
          id: "q_love_whom",
          prompt: "Кого очень любит ребёнок?",
          answer: ["маму", "маму свою"],
          supportLineIds: ["l1"],
        },
        {
          id: "q_gift",
          prompt: "Что ребёнок подарит маме?",
          answer: ["радость"],
          supportLineIds: ["l2"],
        },
        {
          id: "q_where_help",
          prompt: "Где ребёнок будет помогать?",
          answer: ["дома"],
          supportLineIds: ["l3"],
        },
        {
          id: "q_grades",
          prompt: "Что ребёнок будет получать?",
          answer: ["пятёрки", "пятёрки в школе"],
          supportLineIds: ["l4"],
        },
        {
          id: "q_good_grades",
          prompt: "Пятёрки — это хорошие или плохие оценки?",
          answer: ["хорошие", "отличные"],
          supportLineIds: ["l4"],
        },
        {
          id: "q_how_show_love",
          prompt: "Как ребёнок покажет любовь к маме?",
          answer: ["подарит радость", "будет помогать дома", "будет получать пятёрки"],
          supportLineIds: ["l2", "l3", "l4"],
        },
        {
          id: "q_actions",
          prompt: "Что ребёнок будет делать для мамы?",
          answer: ["подарит радость", "поможет дома", "получит пятёрки"],
          supportLineIds: ["l2", "l3", "l4"],
        },
        {
          id: "q_what_kind",
          prompt: "Какой ребёнок в этом стихотворении?",
          answer: ["любящий", "добрый", "трудолюбивый", "хороший", "заботливый"],
          supportLineIds: ["l1", "l2", "l3", "l4"],
        },
        {
          id: "q_mood",
          prompt: "Что ребёнок хочет подарить маме?",
          answer: ["радость"],
          supportLineIds: ["l2"],
        },
        {
          id: "q_help_or_not",
          prompt: "Ребёнок будет помогать маме дома?",
          answer: ["да", "будет"],
          supportLineIds: ["l3"],
        },
        {
          id: "q_first_line",
          prompt: "Как ребёнок относится к маме?",
          answer: ["любит", "очень любит"],
          supportLineIds: ["l1"],
        },
      ],
    },
    {
      id: "family_poem",
      kind: "poem",
      title: { ru: "Наша семья", en: "Our Family" },
      image: "media/family.svg",
      level: 1,
      lines: [
        { id: "l1", text: "Мама и папа- главные самые!" },
        { id: "l2", text: "Нет на земле красивее мамы!" },
        { id: "l3", text: "Папы добрей и сильней в мире нет!" },
        { id: "l4", text: "Кто всех важнее?" },
        { id: "l5", text: "Готов наш ответ:" },
        { id: "l6", text: "Самое главное-это семья!" },
        { id: "l7", text: "Папа и мама, Алина, Полина," },
        { id: "l8", text: "Ну и конечно же, Я!" },
      ],
      questions: [
        {
          id: "q_about",
          prompt: "О чём это стихотворение?",
          answer: ["о семье", "семья"],
          supportLineIds: ["l6", "l7"],
        },
        {
          id: "q_main",
          prompt: "Кто главные самые?",
          answer: ["мама и папа", "папа и мама"],
          supportLineIds: ["l1"],
        },
        {
          id: "q_beautiful",
          prompt: "Кто красивее всех на земле?",
          answer: ["мама"],
          supportLineIds: ["l2"],
        },
        {
          id: "q_dad_character",
          prompt: "Какой папа в стихотворении?",
          answer: ["добрый", "сильный", "добрый и сильный"],
          supportLineIds: ["l3"],
        },
        {
          id: "q_important",
          prompt: "Что самое главное?",
          answer: ["семья"],
          supportLineIds: ["l6"],
        },
        {
          id: "q_who_important",
          prompt: "Кто всех важнее?",
          answer: ["семья"],
          supportLineIds: ["l4", "l5", "l6"],
        },
        {
          id: "q_family_members",
          prompt: "Кто входит в семью в стихотворении?",
          answer: ["папа", "мама", "Алина", "Полина", "я", "все"],
          supportLineIds: ["l7", "l8"],
        },
        {
          id: "q_children_names",
          prompt: "Как зовут детей в стихотворении?",
          answer: ["Алина и Полина", "Алина", "Полина"],
          supportLineIds: ["l7"],
        },
        {
          id: "q_last",
          prompt: "Кого не забыли упомянуть в конце?",
          answer: ["я", "себя", "меня"],
          supportLineIds: ["l8"],
        },
        {
          id: "q_mom_or_dad_main",
          prompt: "Только мама главная или папа тоже?",
          answer: ["оба", "и мама и папа", "папа тоже"],
          supportLineIds: ["l1"],
        },
        {
          id: "q_answer_ready",
          prompt: "Что значит «Готов наш ответ»?",
          answer: ["мы знаем ответ", "ответ готов", "знаем кто важнее"],
          supportLineIds: ["l5", "l6"],
        },
        {
          id: "q_what_kind_family",
          prompt: "Какая семья в стихотворении?",
          answer: ["дружная", "любящая", "счастливая", "хорошая"],
          supportLineIds: ["l1", "l6", "l7", "l8"],
        },
      ],
    },
    {
      id: "sister_love",
      kind: "poem",
      title: { ru: "Моей сестре", en: "To My Sister" },
      cornerPhotos: [
        { file: "media/sister_alina.webp", position: "bottom-left", name: "Алина" },
        { file: "media/sister_polina.webp", position: "bottom-right", name: "Полина" },
      ],
      level: 1,
      lines: [
        { id: "l1", text: "Ты умница-красавица," },
        { id: "l2", text: "Приветлива, добра." },
        { id: "l3", text: "Мне очень-очень нравится," },
        { id: "l4", text: "Что ты моя сестра." },
        { id: "l5", text: "И много раз я повторю:" },
        { id: "l6", text: "Я больше всех тебя люблю." },
      ],
      questions: [
        {
          id: "q_about",
          prompt: "О ком это стихотворение?",
          answer: ["сестра", "о сестре"],
          supportLineIds: ["l4"],
        },
        {
          id: "q_smart_beautiful",
          prompt: "Кто умница-красавица?",
          answer: ["сестра", "ты", "она"],
          supportLineIds: ["l1", "l4"],
        },
        {
          id: "q_character",
          prompt: "Какая сестра в стихотворении?",
          answer: ["умница", "красавица", "приветливая", "добрая"],
          supportLineIds: ["l1", "l2"],
        },
        {
          id: "q_kind_or_mean",
          prompt: "Сестра добрая или злая?",
          answer: ["добрая"],
          supportLineIds: ["l2"],
        },
        {
          id: "q_friendly",
          prompt: "Сестра приветливая?",
          answer: ["да", "приветливая"],
          supportLineIds: ["l2"],
        },
        {
          id: "q_what_like",
          prompt: "Что нравится ребёнку?",
          answer: ["что сестра", "что она сестра", "сестра"],
          supportLineIds: ["l3", "l4"],
        },
        {
          id: "q_relation",
          prompt: "Кем приходится девочка ребёнку?",
          answer: ["сестрой", "моей сестрой"],
          supportLineIds: ["l4"],
        },
        {
          id: "q_repeat",
          prompt: "Что ребёнок повторит много раз?",
          answer: ["что любит", "я люблю", "люблю тебя"],
          supportLineIds: ["l5", "l6"],
        },
        {
          id: "q_love_whom",
          prompt: "Кого ребёнок любит больше всех?",
          answer: ["сестру", "её", "тебя"],
          supportLineIds: ["l6"],
        },
        {
          id: "q_how_much_love",
          prompt: "Как ребёнок любит сестру?",
          answer: ["больше всех", "очень"],
          supportLineIds: ["l6"],
        },
      ],
    },
  ],
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
zip.file("media/dad_best.webp", dadBestImage);
zip.file("media/mom_love.webp", momLoveImage);
zip.file("media/family.svg", familySvg);
zip.file("media/sister_alina.webp", alinaPhoto);
zip.file("media/sister_polina.webp", polinaPhoto);
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_dad_poems_v1.0.20.zip", buffer);
