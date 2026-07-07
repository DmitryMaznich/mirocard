import JSZip from "jszip";
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const whoseBallPath = fileURLToPath(new URL("./assets/reading_short_stories/WhoseBall.png", import.meta.url));
const helpMommyPath = fileURLToPath(new URL("./assets/reading_short_stories/HelpMommy.png", import.meta.url));
const whoseHorsePath = fileURLToPath(new URL("./assets/reading_short_stories/WhoseHorse.png", import.meta.url));

async function buildIllustration(path) {
  return sharp(path)
    .resize(900, 900, { fit: "cover" })
    .webp({ quality: 85 })
    .toBuffer();
}

const [whoseBallImage, helpMommyImage, whoseHorseImage] = await Promise.all([
  buildIllustration(whoseBallPath),
  buildIllustration(helpMommyPath),
  buildIllustration(whoseHorsePath),
]);

// Author-authored syllable breakdown is the source of truth; the plain
// reading variant is derived by removing hyphens placed between letters.
// Dialogue em-dashes ("—") are a different character and are untouched.
function stripSyllables(syllableText) {
  return syllableText.replace(/(\p{L})-(?=\p{L})/gu, "$1");
}

function makeLines(pairs) {
  return pairs.map(([id, syllableText]) => ({
    id,
    text: stripSyllables(syllableText),
    syllableText,
  }));
}

const manifest = {
  meta: {
    id: "reading_short_stories",
    version: "1.0.0",
    minAppVersion: "1.0.2",
    language: "ru",
    renderer: "reading",
    avatar: "media/whose_ball.webp",
    title: { ru: "Чтение: Короткие рассказы", en: "Reading: Short Stories" },
    description: {
      ru: "Короткие рассказы с иллюстрациями, вопросы по смыслу и сборка текста из слов.",
      en: "Short illustrated stories, comprehension questions, and sentence assembly.",
    },
    about: {
      ru: [
        "Тема предназначена для активной работы логопеда с ребёнком.",
        "В режиме «Читаем текст» доступна настройка показа: обычный текст или текст с разбивкой по слогам.",
        "Режим сборки подходит для тренировки порядка слов в предложении.",
      ],
      en: ["Designed for therapist-led reading sessions."],
    },
    conceptCount: 3,
    sessionConfig: { maxSize: 3 },
  },
  modes: [
    {
      id: "read_text",
      requirePin: false,
      params: {
        textStyle: {
          type: "enum",
          label: { ru: "Текст" },
          values: ["normal", "syllables"],
          labels: { ru: { normal: "Обычный", syllables: "По слогам" } },
          default: "normal",
        },
      },
    },
    { id: "understand_text", requirePin: false },
    { id: "assemble_text", requirePin: false },
  ],
  cards: [],
  texts: [
    {
      id: "whose_ball",
      kind: "story",
      title: { ru: "Чей мяч?", en: "Whose Ball?" },
      image: "media/whose_ball.webp",
      level: 1,
      lines: makeLines([
        ["l1", "Был у Ва-ни и Ми-ши мяч."],
        ["l2", "Ва-ня взял мяч."],
        ["l3", "Ми-ша то-же за-хо-тел мяч."],
        ["l4", "Ва-ня ска-зал:"],
        ["l5", "— Дай мяч мне."],
        ["l6", "Ми-ша ска-зал:"],
        ["l7", "— Нет, дай мяч мне."],
        ["l8", "Маль-чи-ки ста-ли тя-нуть мяч."],
        ["l9", "При-шла ма-ма и ска-за-ла:"],
        ["l10", "— Не на-до тя-нуть. Иг-рай-те по о-че-ре-ди."],
        ["l11", "Сна-ча-ла Ва-ня ка-тил мяч."],
        ["l12", "По-том Ми-ша ка-тил мяч."],
        ["l13", "Маль-чи-ки не ссо-ри-лись."],
        ["l14", "О-ни иг-ра-ли по о-че-ре-ди."],
      ]),
      questions: [
        {
          id: "q_conflict",
          prompt: "Из-за чего поссорились мальчики?",
          answer: ["из-за мяча", "мяч"],
          supportLineIds: ["l1", "l3"],
        },
        {
          id: "q_mom_said",
          prompt: "Что сказала мама?",
          answer: ["не надо тянуть", "играйте по очереди"],
          supportLineIds: ["l10"],
        },
        {
          id: "q_good_end",
          prompt: "Хорошо ли поступили мальчики в конце? Почему ты так думаешь?",
          answer: ["хорошо", "да, потому что играли по очереди"],
          supportLineIds: ["l13", "l14"],
        },
      ],
    },
    {
      id: "help_mommy",
      kind: "story",
      title: { ru: "Помощь маме", en: "Helping Mom" },
      image: "media/help_mommy.webp",
      level: 1,
      lines: makeLines([
        ["l1", "Ма-ма нес-ла па-кет."],
        ["l2", "Во-ва ска-зал:"],
        ["l3", "— Ма-ма, дай я по-мо-гу."],
        ["l4", "Ма-ма да-ла Во-ве па-кет."],
        ["l5", "Во-ва нёс па-кет до до-ма."],
        ["l6", "Ма-ма ска-за-ла:"],
        ["l7", "— Спа-си-бо, Во-ва."],
        ["l8", "Во-ва — мо-ло-дец!"],
      ]),
      questions: [
        {
          id: "q_what_carried",
          prompt: "Что несла мама?",
          answer: ["пакет"],
          supportLineIds: ["l1"],
        },
        {
          id: "q_what_said_vova",
          prompt: "Что сказал Вова?",
          answer: ["мама, дай я помогу", "дай я помогу"],
          supportLineIds: ["l3"],
        },
        {
          id: "q_how_helped",
          prompt: "Как Вова помог маме?",
          answer: ["нёс пакет до дома", "понёс пакет"],
          supportLineIds: ["l5"],
        },
        {
          id: "q_what_said_mom",
          prompt: "Что сказала мама?",
          answer: ["спасибо, вова", "спасибо"],
          supportLineIds: ["l7"],
        },
        {
          id: "q_why_well_done",
          prompt: "Почему Вова молодец?",
          answer: ["помог маме", "донёс пакет до дома"],
          supportLineIds: ["l3", "l5", "l8"],
        },
      ],
    },
    {
      id: "whose_horse",
      kind: "story",
      title: { ru: "Чей конь?", en: "Whose Horse?" },
      author: { ru: "Л. Толстой" },
      image: "media/whose_horse.webp",
      level: 1,
      lines: makeLines([
        ["l1", "Был у Пе-ти и Ми-ши конь."],
        ["l2", "Стал у них спор: чей конь."],
        ["l3", "Ста-ли о-ни ко-ня друг у дру-га рвать."],
        ["l4", "— Дай мне — мой конь."],
        ["l5", "— Нет, ты мне дай — конь не твой, а мой."],
        ["l6", "При-шла мать, взя-ла ко-ня, и стал конь ни-чей."],
      ]),
      questions: [
        {
          id: "q_conflict",
          prompt: "Из-за чего ссорились Петя и Миша?",
          answer: ["из-за коня", "чей конь"],
          supportLineIds: ["l2", "l3"],
        },
        {
          id: "q_mom_did",
          prompt: "Что сделала мама?",
          answer: ["взяла коня", "забрала коня"],
          supportLineIds: ["l6"],
        },
        {
          id: "q_good_play",
          prompt: "Хорошо ли дети играли в коня? Почему ты так думаешь?",
          answer: ["нет", "плохо, потому что рвали коня друг у друга"],
          supportLineIds: ["l3"],
        },
      ],
    },
  ],
};

console.log("=== Проверка: syllableText -> вычисленный text ===");
for (const text of manifest.texts) {
  console.log(`\n--- ${text.id} ---`);
  for (const line of text.lines) {
    console.log(`${line.id}: [${line.syllableText}] -> [${line.text}]`);
  }
}

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
zip.file("media/whose_ball.webp", whoseBallImage);
zip.file("media/help_mommy.webp", helpMommyImage);
zip.file("media/whose_horse.webp", whoseHorseImage);
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_short_stories_v1.0.0.zip", buffer);
console.log("\nZIP written to public/decks/reading_short_stories_v1.0.0.zip");
