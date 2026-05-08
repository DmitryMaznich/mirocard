import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";

const dadBestImage = readFileSync(new URL("./assets/reading_dad_poems/dad_best.webp", import.meta.url));

const manifest = {
  meta: {
    id: "reading_dad_poems",
    version: "1.0.4",
    minAppVersion: "1.0.2",
    language: "ru",
    renderer: "reading",
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
    conceptCount: 1,
    sessionConfig: { maxSize: 8 },
  },
  modes: [],
  cards: [],
  texts: [
    {
      id: "dad_best",
      kind: "poem",
      title: { ru: "Папа наш", en: "Our Dad" },
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
  ],
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
zip.file("media/dad_best.webp", dadBestImage);
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_dad_poems_v1.0.4.zip", buffer);
