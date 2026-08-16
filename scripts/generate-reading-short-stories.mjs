import JSZip from "jszip";
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const whoseBallPath = fileURLToPath(new URL("./assets/reading_short_stories/WhoseBall.png", import.meta.url));
const helpMommyPath = fileURLToPath(new URL("./assets/reading_short_stories/HelpMommy.png", import.meta.url));
const whoseHorsePath = fileURLToPath(new URL("./assets/reading_short_stories/WhoseHorse.png", import.meta.url));
const lostMittenPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/lost_mitten.webp", import.meta.url));
const birdFeederPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/bird_feeder.webp", import.meta.url));
const rainyWalkPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/rainy_walk.webp", import.meta.url));
const plantingFlowerPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/planting_flower.webp", import.meta.url));
const hedgehogPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/hedgehog.webp", import.meta.url));
const tidyToysPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/tidy_toys.webp", import.meta.url));
const redPencilPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/red_pencil.webp", import.meta.url));
const zebraCrossingPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/zebra_crossing.webp", import.meta.url));
const cookiesPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/cookies.webp", import.meta.url));

async function buildIllustration(path) {
  return sharp(path)
    .resize(900, 900, { fit: "cover" })
    .webp({ quality: 85 })
    .toBuffer();
}

const illustrationPaths = {
  whose_ball: whoseBallPath,
  help_mommy: helpMommyPath,
  whose_horse: whoseHorsePath,
  lost_mitten: lostMittenPath,
  bird_feeder: birdFeederPath,
  rainy_walk: rainyWalkPath,
  planting_flower: plantingFlowerPath,
  hedgehog: hedgehogPath,
  tidy_toys: tidyToysPath,
  red_pencil: redPencilPath,
  zebra_crossing: zebraCrossingPath,
  cookies: cookiesPath,
};
const illustrations = Object.fromEntries(await Promise.all(
  Object.entries(illustrationPaths).map(async ([id, path]) => [id, await buildIllustration(path)]),
));

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
    version: "1.1.0",
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
    conceptCount: 12,
    sessionConfig: { maxSize: 12 },
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
      title: { ru: "Чья лошадка?", en: "Whose Little Horse?" },
      image: "media/whose_horse.webp",
      level: 1,
      lines: makeLines([
        ["l1", "У Тё-мы и Кос-ти бы-ла од-на ло-шад-ка на ко-лё-си-ках."],
        ["l2", "Тё-ма хо-тел по-ка-тать-ся на ней пер-вым."],
        ["l3", "Кос-тя то-же хо-тел по-ка-тать-ся на ней пер-вым."],
        ["l4", "Маль-чи-ки схва-ти-ли ло-шад-ку и ста-ли тя-нуть каж-дый к се-бе."],
        ["l5", "На шум при-шла ма-ма."],
        ["l6", "— Ес-ли не мо-же-те иг-рать вме-сте, ло-шад-ка по-ка по-жи-вёт в кла-дов-ке, — ска-за-ла ма-ма."],
        ["l7", "Ма-ма за-бра-ла ло-шад-ку."],
        ["l8", "Тё-ма и Кос-тя ос-та-лись без иг-ры."],
      ]),
      questions: [
        {
          id: "q_conflict",
          prompt: "Из-за чего поссорились мальчики?",
          answer: ["из-за лошадки", "лошадка"],
          supportLineIds: ["l1", "l4"],
        },
        {
          id: "q_mom_did",
          prompt: "Что сделала мама?",
          answer: ["забрала лошадку", "убрала лошадку в кладовку"],
          supportLineIds: ["l6", "l7"],
        },
        {
          id: "q_good_play",
          prompt: "Хорошо ли мальчики играли с лошадкой? Почему ты так думаешь?",
          answer: ["нет", "плохо, потому что тянули лошадку каждый к себе"],
          supportLineIds: ["l4"],
        },
      ],
    },
    {
      id: "lost_mitten",
      kind: "story",
      title: { ru: "Пропала варежка", en: "The Lost Mitten" },
      image: "media/lost_mitten.webp",
      level: 1,
      lines: makeLines([
        ["l1", "О-сень-ю И-горь гу-лял в пар-ке."],
        ["l2", "На ска-мей-ке он снял си-нюю ва-реж-ку."],
        ["l3", "По-том И-горь по-бе-жал к ка-че-лям."],
        ["l4", "До-ма И-горь не на-шёл ва-реж-ку."],
        ["l5", "Ма-ма ска-за-ла:"],
        ["l6", "— Вспом-ни, где ты её снял."],
        ["l7", "И-горь вер-нул-ся к ска-мей-ке."],
        ["l8", "Си-няя ва-реж-ка ле-жа-ла там."],
        ["l9", "И-горь был рад."],
      ]),
      questions: [
        { id: "q_where", prompt: "Где Игорь снял варежку?", answer: ["на скамейке"], supportLineIds: ["l2"] },
        { id: "q_why", prompt: "Почему дома Игорь не нашёл варежку?", answer: ["оставил на скамейке", "снял на скамейке"], supportLineIds: ["l2", "l4"] },
        { id: "q_found", prompt: "Как Игорь нашёл варежку?", answer: ["вернулся к скамейке", "вспомнил, где снял"], supportLineIds: ["l6", "l7", "l8"] },
      ],
    },
    {
      id: "bird_feeder",
      kind: "story",
      title: { ru: "Кормушка для птиц", en: "The Bird Feeder" },
      image: "media/bird_feeder.webp",
      level: 1,
      lines: makeLines([
        ["l1", "Зи-мой Ма-ша уви-де-ла си-ни-цу у ок-на."],
        ["l2", "Пти-це бы-ло хо-лод-но и го-лод-но."],
        ["l3", "Па-па сде-лал кор-муш-ку."],
        ["l4", "Ма-ша на-сы-па-ла в неё зёр-на."],
        ["l5", "Ско-ро к кор-муш-ке при-ле-те-ли пти-цы и ста-ли кле-вать зёр-на."],
        ["l6", "Ма-ша на-блю-да-ла в ок-но."],
        ["l7", "Она по-мо-гла пти-цам зи-мо-вать."],
      ]),
      questions: [
        { id: "q_bird", prompt: "Какую птицу увидела Маша?", answer: ["синицу"], supportLineIds: ["l1"] },
        { id: "q_feeder", prompt: "Кто сделал кормушку?", answer: ["папа"], supportLineIds: ["l3"] },
        { id: "q_help", prompt: "Как Маша помогла птицам?", answer: ["насыпала зёрна", "сделала кормушку с папой"], supportLineIds: ["l3", "l4", "l7"] },
      ],
    },
    {
      id: "rainy_walk",
      kind: "story",
      title: { ru: "Дождь и зонт", en: "Rain and an Umbrella" },
      image: "media/rainy_walk.webp",
      level: 1,
      lines: makeLines([
        ["l1", "У-тром по-шёл дождь."],
        ["l2", "Ли-за взя-ла жёл-тый зонт."],
        ["l3", "У во-рот она уви-де-ла щен-ка."],
        ["l4", "Ще-нок дро-жал под кус-том."],
        ["l5", "Ли-за дер-жа-ла зонт над щен-ком, по-ка не за-кон-чил-ся дождь."],
        ["l6", "По-том она по-зва-ла па-пу."],
        ["l7", "Па-па от-нёс щен-ка до-мой."],
        ["l8", "Ще-нок о-стался жить у Ли-зы."],
      ]),
      questions: [
        { id: "q_weather", prompt: "Какая была погода утром?", answer: ["шёл дождь", "дождливая"], supportLineIds: ["l1"] },
        { id: "q_puppy", prompt: "Где был щенок?", answer: ["под кустом", "у ворот"], supportLineIds: ["l3", "l4"] },
        { id: "q_kind", prompt: "Почему Лиза поступила хорошо?", answer: ["помогла щенку", "укрыла щенка зонтом", "позвала папу"], supportLineIds: ["l5", "l6", "l7"] },
      ],
    },
    {
      id: "planting_flower",
      kind: "story",
      title: { ru: "Цветок для бабушки", en: "A Flower for Grandma" },
      image: "media/planting_flower.webp",
      level: 1,
      lines: makeLines([
        ["l1", "У ба-буш-ки был пу-стой гор-шок."],
        ["l2", "Де-нис при-нёс ма-лень-кий цве-ток."],
        ["l3", "Ба-буш-ка на-сы-па-ла в гор-шок зем-лю."],
        ["l4", "Де-нис по-са-дил в зем-лю цве-ток."],
        ["l5", "По-том он по-лил его во-дой."],
        ["l6", "Ба-буш-ка ска-за-ла: — Спа-си-бо, Де-нис."],
        ["l7", "Де-нис бу-дет уха-жи-вать за цве-тком."],
      ]),
      questions: [
        { id: "q_present", prompt: "Что Денис принёс бабушке?", answer: ["цветок", "маленький цветок"], supportLineIds: ["l2"] },
        { id: "q_steps", prompt: "Что Денис сделал после того, как посадил цветок?", answer: ["полил водой", "полил его"], supportLineIds: ["l4", "l5"] },
        { id: "q_care", prompt: "Как Денис будет заботиться о цветке?", answer: ["ухаживать за цветком", "поливать"], supportLineIds: ["l5", "l7"] },
      ],
    },
    {
      id: "hedgehog",
      kind: "story",
      title: { ru: "Ёжик в саду", en: "A Hedgehog in the Garden" },
      image: "media/hedgehog.webp",
      level: 1,
      lines: makeLines([
        ["l1", "В са-ду Ка-тя уви-де-ла е-жа."],
        ["l2", "Ёж си-дел под кус-том."],
        ["l3", "Ка-тя хо-те-ла взять его в ру-ки."],
        ["l4", "Ба-буш-ка ска-за-ла:"],
        ["l5", "— Не тро-гай е-жа. Е-му луч-ше жить в са-ду."],
        ["l6", "Ка-тя по-ста-ви-ла ря-дом ми-ску с во-дой."],
        ["l7", "По-том ёж ушёл под куст."],
        ["l8", "Ка-тя по-мо-гла ёжи-ку."],
      ]),
      questions: [
        { id: "q_where", prompt: "Где Катя увидела ежа?", answer: ["в саду", "под кустом"], supportLineIds: ["l1", "l2"] },
        { id: "q_grandma", prompt: "Почему бабушка попросила не трогать ежа?", answer: ["ему лучше жить в саду", "ёж дикий"], supportLineIds: ["l5"] },
        { id: "q_help", prompt: "Как Катя помогла ёжику?", answer: ["поставила миску с водой", "дала воды"], supportLineIds: ["l6", "l8"] },
      ],
    },
    {
      id: "tidy_toys",
      kind: "story",
      title: { ru: "Убираем игрушки", en: "Tidying Up Toys" },
      image: "media/tidy_toys.webp",
      level: 1,
      lines: makeLines([
        ["l1", "Ут-ром к Ми-ше при-шла На-дя."],
        ["l2", "О-ни иг-ра-ли ку-би-ка-ми."],
        ["l3", "По-сле иг-ры ку-би-ки ле-жа-ли на по-лу."],
        ["l4", "На-дя ска-за-ла:"],
        ["l5", "— Да-вай у-бе-рём иг-руш-ки."],
        ["l6", "Де-ти по-ло-жи-ли ку-би-ки в я-щик."],
        ["l7", "В ком-на-те ста-ло чис-то."],
        ["l8", "Ми-ша ска-зал: — Спа-си-бо, На-дя."],
      ]),
      questions: [
        { id: "q_played", prompt: "Чем играли Миша и Надя?", answer: ["кубиками"], supportLineIds: ["l2"] },
        { id: "q_problem", prompt: "Почему в комнате было не чисто?", answer: ["кубики лежали на полу", "игрушки были на полу"], supportLineIds: ["l3"] },
        { id: "q_result", prompt: "Что сделали дети?", answer: ["убрали игрушки", "положили кубики в ящик"], supportLineIds: ["l5", "l6", "l7"] },
      ],
    },
    {
      id: "red_pencil",
      kind: "story",
      title: { ru: "Красный карандаш", en: "The Red Pencil" },
      image: "media/red_pencil.webp",
      level: 1,
      lines: makeLines([
        ["l1", "На у-ро-ке ри-со-ва-ния Да-ша за-бы-ла ка-ран-даш."],
        ["l2", "Она рас-стро-и-лась."],
        ["l3", "Пе-тя дал ей свой крас-ный ка-ран-даш."],
        ["l4", "Да-ша на-ри-со-ва-ла цве-ток."],
        ["l5", "По-том она вер-ну-ла ка-ран-даш."],
        ["l6", "Да-ша ска-за-ла: — Спа-си-бо, Пе-тя."],
      ]),
      questions: [
        { id: "q_forgot", prompt: "Что забыла Даша?", answer: ["карандаш"], supportLineIds: ["l1"] },
        { id: "q_petya", prompt: "Как Петя помог Даше?", answer: ["дал свой карандаш", "дал красный карандаш"], supportLineIds: ["l3"] },
        { id: "q_return", prompt: "Как Даша поступила после рисования?", answer: ["вернула карандаш", "сказала спасибо Пете"], supportLineIds: ["l5", "l6"] },
      ],
    },
    {
      id: "zebra_crossing",
      kind: "story",
      title: { ru: "У перехода", en: "At the Crossing" },
      image: "media/zebra_crossing.webp",
      level: 1,
      lines: makeLines([
        ["l1", "Се-рё-жа е-хал на ве-ло-си-пе-де."],
        ["l2", "У пе-ре-хо-да он уви-дел ба-буш-ку."],
        ["l3", "Ба-буш-ка хо-те-ла пе-рей-ти до-ро-гу."],
        ["l4", "Се-рё-жа ос-та-но-вил-ся."],
        ["l5", "Он про-пус-тил ба-буш-ку."],
        ["l6", "Ба-буш-ка ска-за-ла: — Спа-си-бо, Се-рё-жа."],
        ["l7", "Се-рё-жа по-е-хал даль-ше."],
      ]),
      questions: [
        { id: "q_transport", prompt: "На чём ехал Серёжа?", answer: ["на велосипеде"], supportLineIds: ["l1"] },
        { id: "q_stop", prompt: "Почему Серёжа остановился?", answer: ["бабушка хотела перейти дорогу", "чтобы пропустить бабушку"], supportLineIds: ["l3", "l4", "l5"] },
        { id: "q_good", prompt: "Почему бабушка сказала Серёже «спасибо»?", answer: ["он пропустил бабушку", "он остановился"], supportLineIds: ["l4", "l5", "l6"] },
      ],
    },
    {
      id: "cookies",
      kind: "story",
      title: { ru: "Печенье", en: "Cookies" },
      image: "media/cookies.webp",
      level: 1,
      lines: makeLines([
        ["l1", "В суб-бо-ту О-ля пе-кла пе-чень-е с ма-мой."],
        ["l2", "Ма-ма сде-ла-ла те-сто."],
        ["l3", "О-ля ска-та-ла ма-лень-кие ша-ри-ки."],
        ["l4", "О-ни по-ло-жи-ли пе-чень-е на про-ти-вень."],
        ["l5", "По-том ма-ма по-ста-ви-ла про-ти-вень в ду-хов-ку."],
        ["l6", "Ско-ро по до-му по-шёл вкус-ный за-пах."],
        ["l7", "О-ля у-го-сти-ла пе-чень-ем па-пу."],
        ["l8", "Па-пе бы-ло вкус-но."],
      ]),
      questions: [
        { id: "q_when", prompt: "Когда Оля пекла печенье?", answer: ["в субботу"], supportLineIds: ["l1"] },
        { id: "q_ola", prompt: "Что делала Оля?", answer: ["скатала маленькие шарики", "угощала папу"], supportLineIds: ["l3", "l7"] },
        { id: "q_order", prompt: "Что мама сделала с противнем?", answer: ["поставила в духовку", "поставила противень в духовку"], supportLineIds: ["l5"] },
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
for (const [id, image] of Object.entries(illustrations)) {
  zip.file(`media/${id}.webp`, image);
}
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_short_stories_v1.1.0.zip", buffer);
console.log("\nZIP written to public/decks/reading_short_stories_v1.1.0.zip");
