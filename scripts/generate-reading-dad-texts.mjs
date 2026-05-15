import JSZip from "jszip";
import { writeFileSync } from "node:fs";

const manifest = {
  meta: {
    id: "reading_dad_texts",
    version: "1.4.0",
    minAppVersion: "1.0.2",
    language: "ru",
    renderer: "reading",
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
      steps: [
        { id: "s1",  type: "action",  text: "Вымой руки." },
        { id: "s2",  type: "bullets", text: "Достань нужную посуду:", items: ["сковородку", "лопатку", "миску", "вилку", "тарелку", "доску", "нож"] },
        { id: "s3",  type: "bullets", text: "Достань продукты:", items: ["2 яйца", "колбасу", "соль", "масло"] },
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
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_dad_texts_v1.4.0.zip", buffer);
