import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";

const dadBestImage = readFileSync(new URL("./assets/reading_dad_poems/dad_best.webp", import.meta.url));
const momLoveImage = readFileSync(new URL("./assets/reading_dad_poems/mom_love.webp", import.meta.url));

const manifest = {
  meta: {
    id: "reading_dad_texts",
    version: "1.1.0",
    minAppVersion: "1.0.2",
    language: "ru",
    renderer: "reading",
    avatar: "media/dad_best.webp",
    title: { ru: "Чтение: Тексты", en: "Reading: Texts" },
    description: {
      ru: "Совместное чтение, вопросы по смыслу, сборка текста из слов и пошаговые инструкции.",
      en: "Shared reading, comprehension questions, text assembly, and step-by-step instructions.",
    },
    about: {
      ru: [
        "Тема предназначена для активной работы логопеда с ребёнком.",
        "Озвучка не является основным сценарием: специалист сам ведёт темп, интонацию и подсказки.",
        "Режим сборки подходит для заучивания текста.",
      ],
      en: ["Designed for therapist-led reading sessions."],
    },
    conceptCount: 2,
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
      id: "omelet_instruction",
      kind: "instruction",
      title: { ru: "Как сделать омлет", en: "How to Make an Omelette" },
      steps: [
        { id: "s1",  type: "action",    text: "Вымой руки." },
        { id: "s2",  type: "checklist", text: "Достань нужную посуду:", items: ["сковородку", "лопатку", "миску", "вилку", "тарелку", "доску", "нож"] },
        { id: "s3",  type: "checklist", text: "Достань продукты:", items: ["2 яйца", "колбасу", "соль", "масло"] },
        { id: "s4",  type: "action",    text: "Поставь сковородку на плиту." },
        { id: "s5",  type: "action",    text: "Нарежь колбасу кружочками на доске." },
        { id: "s6",  type: "action",    text: "Разбей два яйца в миску." },
        { id: "s7",  type: "action",    text: "Добавь щепотку соли." },
        { id: "s8",  type: "action",    text: "Хорошо перемешай яйца вилкой." },
        { id: "s9",  type: "action",    text: "Включи плиту на 10." },
        { id: "s10", type: "action",    text: "Положи масло на сковородку." },
        { id: "s11", type: "action",    text: "Подожди, пока масло растает." },
        { id: "s12", type: "action",    text: "Положи колбасу на сковородку." },
        { id: "s13", type: "action",    text: "Перемешай колбасу лопаткой." },
        { id: "s14", type: "action",    text: "Немного подожди." },
        { id: "s15", type: "action",    text: "Ещё раз перемешай колбасу." },
        { id: "s16", type: "action",    text: "Вылей яйца на колбасу." },
        { id: "s17", type: "action",    text: "Убавь нагрев до 6." },
        { id: "s18", type: "action",    text: "Смотри, чтобы омлет не сгорел." },
        { id: "s19", type: "action",    text: "Подвинь омлет лопаткой." },
        { id: "s20", type: "action",    text: "Немного подожди." },
        { id: "s21", type: "action",    text: "Сложи омлет пополам лопаткой." },
        { id: "s22", type: "action",    text: "Аккуратно переверни омлет." },
        { id: "s23", type: "action",    text: "Немного подожди." },
        { id: "s24", type: "action",    text: "Выключи плиту." },
        { id: "s25", type: "action",    text: "Переложи омлет на тарелку и поставь тарелку на стол." },
        { id: "s26", type: "action",    text: "Поставь сковородку обратно на плиту." },
        { id: "s27", type: "action",    text: "Убери колбасу в холодильник." },
        { id: "s28", type: "action",    text: "Положи грязную посуду в раковину, а мусор выброси в мусорку." },
        { id: "s29", type: "action",    text: "Достань нож и вилку и положи возле тарелки с омлетом." },
        { id: "s30", type: "action",    text: "Можно есть!" },
      ],
    },
  ],
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
zip.file("media/dad_best.webp", dadBestImage);
zip.file("media/mom_love.webp", momLoveImage);
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_dad_texts_v1.1.0.zip", buffer);
