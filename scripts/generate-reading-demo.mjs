import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const dadBestImage = readFileSync(new URL("./assets/reading_dad_poems/dad_best.webp", import.meta.url));
const momLoveImage = readFileSync(new URL("./assets/reading_dad_poems/mom_love.webp", import.meta.url));

const alinaPath = fileURLToPath(new URL("../Alina.png", import.meta.url));
const polinaPath = fileURLToPath(new URL("../Polina.png", import.meta.url));
const alinaWebp = await sharp(alinaPath).resize(200, 200, { fit: "cover", position: "center" }).webp({ quality: 85 }).toBuffer();
const polinaWebp = await sharp(polinaPath).resize(200, 200, { fit: "cover", position: "center" }).webp({ quality: 85 }).toBuffer();
const alinaUri = `data:image/webp;base64,${alinaWebp.toString("base64")}`;
const polinaUri = `data:image/webp;base64,${polinaWebp.toString("base64")}`;

function buildSisterSvg(aUri, pUri) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <defs>
    <radialGradient id="sis-bg" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#fffbfe"/>
      <stop offset="100%" stop-color="#f4d8ec"/>
    </radialGradient>
    <clipPath id="alina-clip"><circle cx="38" cy="180" r="24"/></clipPath>
    <clipPath id="polina-clip"><circle cx="202" cy="180" r="24"/></clipPath>
  </defs>
  <circle cx="120" cy="120" r="116" fill="url(#sis-bg)" stroke="#cc84b4" stroke-width="2.5"/>
  <circle cx="120" cy="120" r="111" fill="none" stroke="#e4b8d4" stroke-width="0.8" stroke-dasharray="2,6"/>
  <ellipse cx="120" cy="203" rx="62" ry="8" fill="#b8dc88" opacity="0.4"/>
  <!-- Dress -->
  <path d="M 84 148 Q 82 200 91 204 L 149 204 Q 158 200 156 148 Q 140 157 120 157 Q 100 157 84 148 Z" fill="#d84080"/>
  <path d="M 86 148 L 89 178 L 151 178 L 154 148 Q 138 157 120 157 Q 102 157 86 148 Z" fill="#e87098"/>
  <path d="M 84 186 Q 88 190 92 186 Q 96 190 100 186 Q 104 190 108 186 Q 112 190 116 186 Q 120 190 124 186 Q 128 190 132 186 Q 136 190 140 186 Q 144 190 148 186 Q 152 190 156 186" fill="none" stroke="#f4b0cc" stroke-width="1.5"/>
  <!-- Sleeves and hands -->
  <ellipse cx="77" cy="153" rx="11" ry="8" fill="#d84080" transform="rotate(-18 77 153)"/>
  <ellipse cx="163" cy="153" rx="11" ry="8" fill="#d84080" transform="rotate(18 163 153)"/>
  <circle cx="69" cy="162" r="7" fill="#f4c49c"/>
  <circle cx="171" cy="162" r="7" fill="#f4c49c"/>
  <!-- Neck and head -->
  <rect x="112" y="120" width="16" height="16" rx="4" fill="#f4c49c"/>
  <circle cx="120" cy="106" r="27" fill="#f4c49c"/>
  <!-- Hair -->
  <path d="M 93 98 Q 97 70 120 66 Q 143 70 147 98 L 147 90 Q 143 60 120 56 Q 97 60 93 90 Z" fill="#7a1048"/>
  <ellipse cx="93" cy="106" rx="8" ry="13" fill="#7a1048"/>
  <ellipse cx="147" cy="106" rx="8" ry="13" fill="#7a1048"/>
  <!-- Bow -->
  <ellipse cx="106" cy="68" rx="9" ry="5.5" fill="#ff2288" transform="rotate(-25 106 68)"/>
  <ellipse cx="134" cy="68" rx="9" ry="5.5" fill="#ff2288" transform="rotate(25 134 68)"/>
  <circle cx="120" cy="66" r="5" fill="#ff2288"/>
  <circle cx="120" cy="66" r="3" fill="#ff88bb"/>
  <!-- Eyes -->
  <ellipse cx="111" cy="105" rx="4" ry="5" fill="#3a1050"/>
  <ellipse cx="129" cy="105" rx="4" ry="5" fill="#3a1050"/>
  <circle cx="112" cy="103" r="1.5" fill="white"/>
  <circle cx="130" cy="103" r="1.5" fill="white"/>
  <!-- Smile and cheeks -->
  <path d="M 113 117 Q 120 124 127 117" stroke="#b84040" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <ellipse cx="104" cy="114" rx="6" ry="4" fill="#ffaabb" opacity="0.45"/>
  <ellipse cx="136" cy="114" rx="6" ry="4" fill="#ffaabb" opacity="0.45"/>
  <path d="M 112 136 L 120 142 L 128 136" fill="none" stroke="#f4b0cc" stroke-width="1.2"/>
  <!-- Connecting arcs with hearts -->
  <path d="M 63 173 Q 78 168 88 168" stroke="#e890b8" stroke-width="1" fill="none" stroke-dasharray="2,3" opacity="0.7"/>
  <path d="M 177 173 Q 162 168 152 168" stroke="#e890b8" stroke-width="1" fill="none" stroke-dasharray="2,3" opacity="0.7"/>
  <text x="75" y="166" text-anchor="middle" font-size="7" fill="#e060a0">&#x2665;</text>
  <text x="163" y="166" text-anchor="middle" font-size="7" fill="#e060a0">&#x2665;</text>
  <!-- Alina photo frame -->
  <circle cx="39" cy="181" r="26" fill="black" fill-opacity="0.07"/>
  <circle cx="38" cy="180" r="26" fill="white"/>
  <image href="${aUri}" x="14" y="156" width="48" height="48" clip-path="url(#alina-clip)" preserveAspectRatio="xMidYMid slice"/>
  <circle cx="38" cy="180" r="26" fill="none" stroke="#b86098" stroke-width="2.2"/>
  <circle cx="38" cy="180" r="22.5" fill="none" stroke="#e8a8cc" stroke-width="0.7" stroke-dasharray="1.5,2.5"/>
  <circle cx="65.5" cy="180" r="2" fill="#b86098"/>
  <circle cx="57.5" cy="199.5" r="2" fill="#b86098"/>
  <circle cx="38" cy="207.5" r="2" fill="#b86098"/>
  <circle cx="18.5" cy="199.5" r="2" fill="#b86098"/>
  <circle cx="10.5" cy="180" r="2" fill="#b86098"/>
  <circle cx="18.5" cy="160.5" r="2" fill="#b86098"/>
  <circle cx="38" cy="152.5" r="2" fill="#b86098"/>
  <circle cx="57.5" cy="160.5" r="2" fill="#b86098"/>
  <text x="38" y="152" text-anchor="middle" font-size="8" fill="#d04880">&#x2665;</text>
  <text x="38" y="215" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-style="italic" font-size="9" fill="#a84090">Алина</text>
  <!-- Polina photo frame -->
  <circle cx="203" cy="181" r="26" fill="black" fill-opacity="0.07"/>
  <circle cx="202" cy="180" r="26" fill="white"/>
  <image href="${pUri}" x="178" y="156" width="48" height="48" clip-path="url(#polina-clip)" preserveAspectRatio="xMidYMid slice"/>
  <circle cx="202" cy="180" r="26" fill="none" stroke="#b86098" stroke-width="2.2"/>
  <circle cx="202" cy="180" r="22.5" fill="none" stroke="#e8a8cc" stroke-width="0.7" stroke-dasharray="1.5,2.5"/>
  <circle cx="229.5" cy="180" r="2" fill="#b86098"/>
  <circle cx="221.5" cy="199.5" r="2" fill="#b86098"/>
  <circle cx="202" cy="207.5" r="2" fill="#b86098"/>
  <circle cx="182.5" cy="199.5" r="2" fill="#b86098"/>
  <circle cx="174.5" cy="180" r="2" fill="#b86098"/>
  <circle cx="182.5" cy="160.5" r="2" fill="#b86098"/>
  <circle cx="202" cy="152.5" r="2" fill="#b86098"/>
  <circle cx="221.5" cy="160.5" r="2" fill="#b86098"/>
  <text x="202" y="152" text-anchor="middle" font-size="8" fill="#d04880">&#x2665;</text>
  <text x="202" y="215" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-style="italic" font-size="9" fill="#a84090">Полина</text>
  <!-- Sparkles -->
  <circle cx="58" cy="52" r="3" fill="#ffd700" opacity="0.7"/>
  <circle cx="182" cy="57" r="3" fill="#ffd700" opacity="0.7"/>
  <circle cx="46" cy="75" r="2" fill="#ffb0d8" opacity="0.65"/>
  <circle cx="194" cy="75" r="2" fill="#ffb0d8" opacity="0.65"/>
  <circle cx="50" cy="96" r="1.5" fill="#ffd700" opacity="0.5"/>
  <circle cx="190" cy="96" r="1.5" fill="#ffd700" opacity="0.5"/>
  <circle cx="120" cy="10" r="2.5" fill="#ffd700" opacity="0.5"/>
</svg>`;
}
const sisterSvg = buildSisterSvg(alinaUri, polinaUri);

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
    version: "1.0.14",
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
  modes: [],
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
      image: "media/sister_love.svg",
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
zip.file("media/sister_love.svg", sisterSvg);
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_dad_poems_v1.0.14.zip", buffer);
