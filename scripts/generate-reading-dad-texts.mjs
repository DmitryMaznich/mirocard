import JSZip from "jszip";
import { writeFileSync } from "node:fs";

const omeletSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <!-- Background circle -->
  <circle cx="120" cy="120" r="116" fill="#fff9ed" stroke="#f0e4c4" stroke-width="3"/>

  <!-- Plate shadow -->
  <ellipse cx="122" cy="178" rx="68" ry="10" fill="#e0c890" opacity="0.35"/>

  <!-- Plate -->
  <circle cx="120" cy="130" r="72" fill="#fffdf5" stroke="#e8dfc0" stroke-width="2.5"/>
  <circle cx="120" cy="130" r="64" fill="none" stroke="#f5edda" stroke-width="1.5"/>

  <!-- Omelet body (base) -->
  <ellipse cx="120" cy="146" rx="54" ry="20" fill="#f0b820"/>

  <!-- Omelet dome (fold) -->
  <path d="M 66 146 Q 70 94 120 92 Q 170 94 174 146 Z" fill="#f5c830"/>

  <!-- Omelet highlight -->
  <path d="M 78 132 Q 90 104 120 100 Q 150 104 162 132"
        fill="none" stroke="#fde88a" stroke-width="3" stroke-linecap="round" opacity="0.7"/>

  <!-- Omelet edge (browned) -->
  <path d="M 66 146 Q 70 94 120 92 Q 170 94 174 146"
        fill="none" stroke="#d4920a" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>

  <!-- Sausage slice 1 -->
  <circle cx="90" cy="124" r="14" fill="#b83228"/>
  <circle cx="90" cy="124" r="11" fill="#d44840"/>
  <circle cx="90" cy="124" r="6"  fill="#c03830"/>
  <circle cx="87" cy="121" r="2"  fill="#e06050" opacity="0.6"/>

  <!-- Sausage slice 2 -->
  <circle cx="120" cy="116" r="14" fill="#b83228"/>
  <circle cx="120" cy="116" r="11" fill="#d44840"/>
  <circle cx="120" cy="116" r="6"  fill="#c03830"/>
  <circle cx="117" cy="113" r="2"  fill="#e06050" opacity="0.6"/>

  <!-- Sausage slice 3 -->
  <circle cx="150" cy="124" r="14" fill="#b83228"/>
  <circle cx="150" cy="124" r="11" fill="#d44840"/>
  <circle cx="150" cy="124" r="6"  fill="#c03830"/>
  <circle cx="147" cy="121" r="2"  fill="#e06050" opacity="0.6"/>

  <!-- Herb specks -->
  <circle cx="104" cy="136" r="2.5" fill="#5a9040" opacity="0.8"/>
  <circle cx="132" cy="133" r="2"   fill="#5a9040" opacity="0.8"/>
  <circle cx="113" cy="141" r="2"   fill="#5a9040" opacity="0.7"/>
  <circle cx="142" cy="138" r="2.5" fill="#5a9040" opacity="0.8"/>
</svg>`;


const mashedPotatoesSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <!-- Background circle -->
  <circle cx="120" cy="120" r="116" fill="#fdf6e3" stroke="#e8d9b0" stroke-width="3"/>

  <!-- Plate shadow -->
  <ellipse cx="122" cy="182" rx="70" ry="10" fill="#d4b870" opacity="0.3"/>

  <!-- Plate -->
  <circle cx="120" cy="134" r="74" fill="#fffef8" stroke="#e8dfc0" stroke-width="2.5"/>
  <circle cx="120" cy="134" r="66" fill="none" stroke="#f5edda" stroke-width="1.5"/>

  <!-- Mashed potato mound -->
  <ellipse cx="120" cy="152" rx="52" ry="16" fill="#e8d89a"/>
  <path d="M 68 152 Q 72 100 120 96 Q 168 100 172 152 Z" fill="#f0e4b0"/>

  <!-- Mound highlight -->
  <path d="M 82 138 Q 98 110 120 106 Q 142 110 158 138"
        fill="none" stroke="#fdf5d0" stroke-width="4" stroke-linecap="round" opacity="0.7"/>

  <!-- Mound shading left -->
  <path d="M 68 152 Q 72 124 86 112" fill="none" stroke="#d4b870" stroke-width="2" opacity="0.4"/>

  <!-- Butter pat -->
  <rect x="106" y="102" width="28" height="16" rx="3" fill="#f5c830" opacity="0.9"/>
  <rect x="106" y="102" width="28" height="16" rx="3" fill="none" stroke="#d4a020" stroke-width="1" opacity="0.5"/>

  <!-- Melting butter drips -->
  <path d="M 110 118 Q 108 128 106 134" fill="none" stroke="#f0b820" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
  <path d="M 130 118 Q 132 128 134 136" fill="none" stroke="#f0b820" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>

  <!-- Steam wisps -->
  <path d="M 100 90 Q 96 78 100 68" fill="none" stroke="#c8b888" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
  <path d="M 120 86 Q 116 74 120 62" fill="none" stroke="#c8b888" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
  <path d="M 140 90 Q 144 78 140 68" fill="none" stroke="#c8b888" stroke-width="2" stroke-linecap="round" opacity="0.45"/>

  <!-- Herb specks (parsley) -->
  <circle cx="96"  cy="140" r="2.5" fill="#4a8030" opacity="0.75"/>
  <circle cx="144" cy="138" r="2"   fill="#4a8030" opacity="0.75"/>
  <circle cx="118" cy="148" r="2"   fill="#4a8030" opacity="0.7"/>
  <circle cx="108" cy="144" r="1.5" fill="#4a8030" opacity="0.65"/>
</svg>`;

const manifest = {
  meta: {
    id: "reading_dad_texts",
    version: "1.10.0",
    minAppVersion: "1.0.2",
    language: "ru",
    renderer: "reading",
    avatar: "media/omelet.svg",
    title: { ru: "Чтение: Тексты", en: "Reading: Texts" },
    description: {
      ru: "Пошаговые инструкции для самостоятельных действий.",
      en: "Step-by-step instructions for independent tasks.",
    },
    about: {
      ru: ["Тема предназначена для работы логопеда с ребёнком."],
      en: ["Designed for therapist-led sessions."],
    },
    conceptCount: 2,
    sessionConfig: { maxSize: 8 },
  },
  modes: [],
  cards: [],
  texts: [
    {
      id: "omelet_instruction",
      kind: "instruction",
      title: { ru: "Как сделать омлет", en: "How to Make an Omelette" },
      image: "media/omelet.svg",
      steps: [
        { id: "s1",  type: "action",  text: "Вымой руки." },
        { id: "s2",  type: "checklist", text: "Достань нужную посуду:", items: ["сковородку", "лопатку", "миску", "вилку", "тарелку", "доску", "нож"] },
        { id: "s3",  type: "checklist", text: "Достань продукты:", items: ["2 яйца", "колбасу", "соль", "масло"] },
        { id: "s4",  type: "action",  text: "Поставь сковородку на плиту." },
        { id: "s5",  type: "action",  text: "Нарежь колбасу кружочками на доске." },
        { id: "s6",  type: "action",  text: "Разбей два яйца в миску." },
        { id: "s7",  type: "action",  text: "Добавь щепотку соли." },
        { id: "s8",  type: "action",  text: "Взбей яйца вилкой." },
        { id: "s9",  type: "action",  text: "Включи плиту на 10." },
        { id: "s10", type: "action",  text: "Растопи масло на сковороде." },
        { id: "s11", type: "action",  text: "Положи колбасу на сковородку." },
        { id: "s12", type: "action",  text: "Перемешай колбасу лопаткой." },
        { id: "s13", type: "action",  text: "Немного подожди." },
        { id: "s14", type: "action",  text: "Вылей яйца на колбасу." },
        { id: "s15", type: "action",  text: "Убавь нагрев до 6." },
        { id: "s16", type: "action",  text: "Смотри, чтобы омлет не сгорел." },
        { id: "s17", type: "action",  text: "Подвинь омлет лопаткой." },
        { id: "s18", type: "action",  text: "Немного подожди." },
        { id: "s19", type: "action",  text: "Сложи омлет пополам лопаткой." },
        { id: "s20", type: "action",  text: "Аккуратно переверни омлет." },
        { id: "s21", type: "action",  text: "Немного подожди." },
        { id: "s22", type: "action",  text: "Выключи плиту." },
        { id: "s23", type: "action",  text: "Переложи омлет на тарелку и поставь тарелку на стол." },
        { id: "s24", type: "action",  text: "Поставь сковородку обратно на плиту." },
        { id: "s25", type: "action",  text: "Убери колбасу в холодильник." },
        { id: "s26", type: "action",  text: "Положи грязную посуду в раковину, а мусор выброси в мусорку." },
        { id: "s27", type: "action",  text: "Достань нож и вилку и положи возле тарелки с омлетом." },
        { id: "s28", type: "action",  text: "Можно завтракать!" },
      ],
    },
    {
      id: "mashed_potatoes_instruction",
      kind: "instruction",
      title: { ru: "Как сделать картофельное пюре", en: "How to Make Mashed Potatoes" },
      image: "media/mashed_potatoes.svg",
      steps: [
        { id: "s1",  type: "action",    text: "Вымой руки." },
        { id: "s2",  type: "checklist", text: "Достань нужную посуду:", items: ["кастрюлю", "овощечистку", "нож", "доску", "толкушку", "дуршлаг", "ложку", "тарелку"] },
        { id: "s3",  type: "checklist", text: "Достань продукты:", items: ["4 картошки", "масло", "молоко", "соль"] },
        { id: "s4",  type: "action",    text: "Помой картошку в раковине." },
        { id: "s5",  type: "action",    text: "Почисти картошку овощечисткой." },
        { id: "s6",  type: "action",    text: "Нарежь каждую картошку на 4 части." },
        { id: "s7",  type: "action",    text: "Положи картошку в кастрюлю." },
        { id: "s8",  type: "action",    text: "Залей картошку водой — вода должна покрывать картошку." },
        { id: "s9",  type: "action",    text: "Добавь в воду 2 щепотки соли." },
        { id: "s10", type: "action",    text: "Поставь кастрюлю на плиту." },
        { id: "s11", type: "action",    text: "Включи плиту на 10." },
        { id: "s12", type: "action",    text: "Подожди, пока вода закипит." },
        { id: "s13", type: "action",    text: "Убавь нагрев до 6." },
        { id: "s14", type: "action",    text: "Вари картошку 20 минут." },
        { id: "s15", type: "action",    text: "Проткни картошку вилкой — если мягкая, готова." },
        { id: "s16", type: "action",    text: "Выключи плиту." },
        { id: "s17", type: "action",    text: "Осторожно слей воду через дуршлаг." },
        { id: "s18", type: "action",    text: "Верни картошку обратно в кастрюлю." },
        { id: "s19", type: "action",    text: "Добавь кусочек масла — размером с большой палец." },
        { id: "s20", type: "action",    text: "Разомни картошку толкушкой." },
        { id: "s21", type: "action",    text: "Влей полстакана молока." },
        { id: "s22", type: "action",    text: "Взбей пюре толкушкой до гладкости." },
        { id: "s23", type: "action",    text: "Попробуй пюре." },
        { id: "s24", type: "action",    text: "Добавь соли, если нужно." },
        { id: "s25", type: "action",    text: "Положи пюре на тарелку." },
        { id: "s26", type: "action",    text: "Убери молоко и масло в холодильник." },
        { id: "s27", type: "action",    text: "Положи грязную посуду в раковину, а мусор выброси в мусорку." },
        { id: "s28", type: "action",    text: "Можно есть!" },
      ],
    },
  ],
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
zip.file("media/omelet.svg", omeletSvg);
zip.file("media/mashed_potatoes.svg", mashedPotatoesSvg);
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_dad_texts_v1.10.0.zip", buffer);
