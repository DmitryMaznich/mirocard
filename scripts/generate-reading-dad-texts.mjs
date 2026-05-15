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


const manifest = {
  meta: {
    id: "reading_dad_texts",
    version: "1.7.0",
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
    conceptCount: 1,
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
  ],
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
zip.file("media/omelet.svg", omeletSvg);
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_dad_texts_v1.7.0.zip", buffer);
