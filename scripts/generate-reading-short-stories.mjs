import JSZip from "jszip";
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const whoseBallPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/whose_ball_v2.png", import.meta.url));
const helpMommyPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/help_mommy_v2.png", import.meta.url));
const whoseHorsePath = fileURLToPath(new URL("./assets/reading_short_stories/generated/whose_horse_v2.png", import.meta.url));
const lostMittenPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/lost_hat_v2.png", import.meta.url));
const birdFeederPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/bird_feeder_v2.png", import.meta.url));
const rainyWalkPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/rainy_walk_v2.png", import.meta.url));
const plantingFlowerPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/planting_flower_v2.png", import.meta.url));
const hedgehogPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/hedgehog_v2.png", import.meta.url));
const tidyToysPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/tidy_toys_v2.png", import.meta.url));
const redPencilPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/red_pencil_v2.png", import.meta.url));
const zebraCrossingPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/zebra_crossing_v2.png", import.meta.url));
const cookiesPath = fileURLToPath(new URL("./assets/reading_short_stories/generated/cookies_v2.png", import.meta.url));

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
// Dialogue en dashes ("–") are a different character and are untouched.
function stripSyllables(syllableText) {
  return syllableText.replace(/(\p{L})-(?=\p{L})/gu, "$1");
}

// Optional 3rd tuple element `{ newParagraph: true }` marks a line as the
// start of a new paragraph – the flow renderer (index.jsx) groups lines into
// <p> blocks on that boundary instead of running the whole story as one
// paragraph. Break points are chosen editorially: before a dialogue exchange
// starts, and again once it resolves into a new narrative beat.
function makeLines(pairs) {
  return pairs.map(([id, syllableText, opts]) => ({
    id,
    text: stripSyllables(syllableText),
    syllableText,
    ...(opts?.newParagraph ? { newParagraph: true } : {}),
  }));
}

const manifest = {
  meta: {
    id: "reading_short_stories",
    version: "1.5.2",
    minAppVersion: "1.0.2",
    language: "ru",
    renderer: "reading",
    avatar: "media/whose_ball.webp",
    title: { ru: "Чтение: Короткие рассказы", en: "Reading: Short Stories" },
    description: {
      ru: "Двенадцать коротких рассказов с иллюстрациями для совместного чтения (обычный текст или по слогам). После чтения родитель или логопед сам задаёт ребёнку вопросы по смыслу.",
      en: "Twelve short illustrated stories for shared reading (normal text or syllable-split). After reading, the parent or therapist asks the child their own comprehension questions.",
    },
    about: {
      ru: [
        "Тема предназначена для активной работы логопеда с ребёнком.",
        "Режим «Читаем рассказы» читает все двенадцать рассказов подряд одной сессией – «Готово» на одном сразу открывает следующий.",
        "В настройках режима можно выбрать, какие именно рассказы читать (по умолчанию – все), и показ текста: обычный или по слогам.",
        "После чтения задавайте ребёнку вопросы по содержанию сами – тема не включает встроенную проверку понимания.",
      ],
      en: ["Designed for therapist-led reading sessions."],
    },
    conceptCount: 12,
    sessionConfig: { maxSize: 12 },
    // This deck wants exactly one custom mode, "Читаем рассказы" – not the
    // shared DEFAULT_MODES.reading "read_text" entry (comprehension quiz,
    // word-scramble, instructions, safe-code, a poem book, letter sorting,
    // math-operation narratives all excluded too, same as before).
    //
    // read_text is excluded here specifically so our own mode below (same
    // `type: "read_text"` for the engine, but a different `id`) doesn't get
    // merged against – and diluted by – the DEFAULT_MODES.reading read_text
    // entry: mergeDefaultModes() in topicLoader.js replaces a manifest
    // mode's own `ui`/`params` with the default's whenever the mode `id`
    // matches a DEFAULT_MODES entry, silently discarding a deck's own title
    // and param list (confirmed via a scratch test against normalizeReading
    // 2026-09-14 while adding the selectedStories param below – this isn't
    // documented anywhere and is easy to trip over again). Giving this
    // deck's mode an id ("read_stories") that matches nothing in
    // DEFAULT_MODES.reading makes topicLoader treat it as fully custom, so
    // its own ui/params survive untouched.
    excludeDefaultModes: [
      "read_text",
      "understand_text", "assemble_text", "follow_instruction", "safe_code",
      "read_poem_book", "sort_letters", "operation_observe",
      "operation_name_action", "operation_do_action",
    ],
  },
  modes: [
    {
      id: "read_stories",
      type: "read_text",
      requirePin: false,
      evaluation: "none",
      ui: {
        title: { ru: "Читаем рассказы" },
        instruction: { ru: "Читайте вместе с ребёнком" },
        icon: "media/icons/reading_read.svg",
      },
      params: {
        selectedStories: {
          type: "enum_multi",
          label: { ru: "Рассказы" },
          values: [
            "whose_ball", "help_mommy", "whose_horse", "lost_mitten",
            "bird_feeder", "rainy_walk", "planting_flower", "hedgehog",
            "tidy_toys", "red_pencil", "zebra_crossing", "cookies",
          ],
          labels: {
            ru: {
              whose_ball: "Мяч по очереди", help_mommy: "Помощь маме", whose_horse: "Можно покататься?",
              lost_mitten: "Где шапка?", bird_feeder: "Кормушка за окном", rainy_walk: "Прогулка в дождь",
              planting_flower: "Новый лист", hedgehog: "Ёжик в саду", tidy_toys: "Убираем игрушки",
              red_pencil: "Карандаш Пети", zebra_crossing: "Переход", cookies: "Печенье для папы",
            },
          },
          // [] means "all" – see EnumMultiParam in ParamsScreen.jsx.
          default: [],
        },
        textStyle: {
          type: "enum",
          label: { ru: "Текст" },
          values: ["normal", "syllables"],
          labels: { ru: { normal: "Обычный", syllables: "По слогам" } },
          default: "normal",
        },
      },
    },
  ],
  cards: [],
  texts: [
    {
      id: "whose_ball",
      kind: "story",
      title: { ru: "Мяч по очереди", en: "Taking Turns with a Ball" },
      image: "media/whose_ball.webp",
      level: 1,
      lines: makeLines([
        ["l1", "У Ва-ни и Ми-ши был один мяч."],
        ["l2", "Ва-ня ка-тал мяч."],
        ["l3", "Ми-ша то-же хо-тел иг-рать."],
        ["l4", "Он взял-ся за мяч."],
        ["l5", "Ва-ня не хо-тел е-го от-да-вать."],
        ["l6", "Маль-чи-ки ста-ли тя-нуть мяч."],
        ["l7", "Ма-ма по-дош-ла и ска-за-ла:", { newParagraph: true }],
        ["l8", "– Вас дво-е, а мяч один. Ка-тай-те по о-че-ре-ди. Сна-ча-ла Ва-ня по-ка-та-ет пять раз, по-том Ми-ша – пять раз."],
        ["l9", "Маль-чи-ки со-гла-си-лись."],
        ["l10", "Сна-ча-ла мяч ка-тал Ва-ня. По-том мяч ка-тал Ми-ша."],
        ["l11", "О-ни ка-та-ли мяч по о-че-ре-ди и боль-ше не ссо-ри-лись."],
      ]),
    },
    {
      id: "help_mommy",
      kind: "story",
      title: { ru: "Помощь маме", en: "Helping Mom" },
      image: "media/help_mommy.webp",
      level: 1,
      lines: makeLines([
        ["l1", "Ма-ма нес-ла из ма-га-зи-на тя-жё-лый па-кет с про-дук-та-ми."],
        ["l2", "Во-ва уви-дел, что ма-ме тя-же-ло."],
        ["l3", "– Ма-ма, да-вай я по-не-су па-кет, – пред-ло-жил он."],
        ["l4", "Ма-ма да-ла Во-ве па-кет.", { newParagraph: true }],
        ["l5", "Во-ва шёл ря-дом с ма-мой и нёс па-кет."],
        ["l6", "До-ма о-ни вме-сте по-ста-ви-ли по-куп-ки на стол."],
        ["l7", "– Спа-си-бо за по-мощь, – ска-за-ла ма-ма."],
        ["l8", "По-мо-гать – э-то хо-ро-шо!"],
      ]),
    },
    {
      id: "whose_horse",
      kind: "story",
      title: { ru: "Можно покататься?", en: "May I Ride?" },
      image: "media/whose_horse.webp",
      level: 1,
      lines: makeLines([
        ["l1", "У Тё-мы бы-ла ло-шад-ка на ко-лё-си-ках."],
        ["l2", "Кос-тя при-шёл в гос-ти к Тё-ме."],
        ["l3", "Он уви-дел ло-шад-ку и за-хо-тел по-ка-тать-ся."],
        ["l4", "– Тё-ма, мож-но я по-ка-та-юсь на ло-шад-ке? – спро-сил Кос-тя.", { newParagraph: true }],
        ["l5", "– Ко-неч-но, мож-но, – ска-зал Тё-ма."],
        ["l6", "Кос-тя по-ка-тал-ся на ло-шад-ке по ком-на-те.", { newParagraph: true }],
        ["l7", "– Спа-си-бо, Тё-ма, – ска-зал он."],
        ["l8", "Спра-ши-вать раз-ре-ше-ния – э-то хо-ро-шо!"],
      ]),
    },
    {
      id: "lost_mitten",
      kind: "story",
      title: { ru: "Где шапка?", en: "Where Is the Hat?" },
      image: "media/lost_mitten.webp",
      level: 1,
      lines: makeLines([
        ["l1", "О-сень-ю И-горь гу-лял в пар-ке."],
        ["l2", "Е-му ста-ло жар-ко."],
        ["l3", "Он снял шап-ку и по-ло-жил е-ё на ска-мей-ку."],
        ["l4", "По-том И-горь по-бе-жал к ка-че-лям."],
        ["l5", "До-ма он за-ме-тил, что шап-ки нет."],
        ["l6", "Ма-ма ска-за-ла:", { newParagraph: true }],
        ["l7", "– Давай вспом-ним, где ты е-ё ос-та-вил."],
        ["l8", "И-горь вспом-нил ска-мей-ку."],
        ["l9", "О-ни вер-ну-лись в парк.", { newParagraph: true }],
        ["l10", "Шап-ка ле-жа-ла на ска-мей-ке."],
        ["l11", "И-горь на-шёл шап-ку."],
        ["l12", "Нуж-но сле-дить за сво-и-ми ве-ща-ми!"],
      ]),
    },
    {
      id: "bird_feeder",
      kind: "story",
      title: { ru: "Кормушка за окном", en: "The Window Bird Feeder" },
      image: "media/bird_feeder.webp",
      level: 1,
      lines: makeLines([
        ["l1", "Зи-мой Ма-ша уви-де-ла за ок-ном си-ни-цу."],
        ["l2", "– Па-па, по-че-му си-ни-ца си-дит у нас на ок-не? – спро-си-ла Ма-ша.", { newParagraph: true }],
        ["l3", "– Зи-мой пти-цам труд-но най-ти корм, и о-ни при-ле-та-ют по-бли-же к лю-дям, – ска-зал па-па."],
        ["l4", "– Па-па, а да-вай сде-ла-ем кор-муш-ку для птиц, – пред-ло-жи-ла Ма-ша."],
        ["l5", "– Давай, – ска-зал па-па и сде-лал кор-муш-ку."],
        ["l6", "Ма-ша на-сы-па-ла в кор-муш-ку се-меч-ки.", { newParagraph: true }],
        ["l7", "Па-па по-ве-сил кор-муш-ку за ок-ном."],
        ["l8", "К кор-муш-ке при-ле-те-ли пти-цы и ста-ли кле-вать се-меч-ки."],
        ["l9", "Ма-ша по-мо-гла пти-цам."],
        ["l10", "За-бо-тить-ся о тех, ко-му труд-но, – э-то хо-ро-шо!"],
      ]),
    },
    {
      id: "rainy_walk",
      kind: "story",
      title: { ru: "Прогулка в дождь", en: "A Walk in the Rain" },
      image: "media/rainy_walk.webp",
      level: 1,
      lines: makeLines([
        ["l1", "У-тром Ли-за хо-те-ла ид-ти гу-лять с па-пой."],
        ["l2", "Но на у-ли-це шёл дождь."],
        ["l3", "Ли-за рас-стро-и-лась."],
        ["l4", "– Па-па, мы не пой-дём гу-лять? – спро-си-ла о-на.", { newParagraph: true }],
        ["l5", "– Пой-дём, Ли-за. Возь-мём зонт, что-бы не про-мок-нуть, и на-де-нем ре-зи-но-вые са-по-ги, – ска-зал па-па."],
        ["l6", "Ли-за на-де-ла са-по-ги и взя-ла зонт."],
        ["l7", "О-ни гу-ля-ли по до-рож-ке и об-хо-ди-ли боль-шие лу-жи."],
        ["l8", "По-э-то-му но-ги не про-мок-ли."],
        ["l9", "До-ма Ли-за по-ста-ви-ла су-шить-ся са-по-ги и зонт."],
        ["l10", "Для про-гул-ки в дождь нуж-ны зонт и са-по-ги!"],
      ]),
    },
    {
      id: "planting_flower",
      kind: "story",
      title: { ru: "Новый лист", en: "A New Leaf" },
      image: "media/planting_flower.webp",
      level: 1,
      lines: makeLines([
        ["l1", "У ба-буш-ки был пу-стой гор-шок."],
        ["l2", "Де-нис при-нёс ма-лень-кий цве-ток."],
        ["l3", "– Ба-буш-ка, я хо-чу по-са-дить э-тот цве-ток в гор-шок, – ска-зал Де-нис."],
        ["l4", "Ба-буш-ка на-сы-па-ла в гор-шок зем-лю."],
        ["l5", "Де-нис сде-лал в зем-ле ям-ку и по-са-дил цве-ток."],
        ["l6", "По-том он по-лил зем-лю."],
        ["l7", "Ба-буш-ка по-ста-ви-ла гор-шок на ок-но."],
        ["l8", "Каж-дое ут-ро Де-нис по-ли-вал цве-ток."],
        ["l9", "Че-рез не-де-лю на цве-тке по-я-ви-лись но-вые ли-стья."],
        ["l10", "Что-бы рас-те-ние рос-ло, о нём на-до за-бо-тить-ся!"],
      ]),
    },
    {
      id: "hedgehog",
      kind: "story",
      title: { ru: "Ёжик в саду", en: "A Hedgehog in the Garden" },
      image: "media/hedgehog.webp",
      level: 1,
      lines: makeLines([
        ["l1", "В са-ду Ка-тя уви-де-ла е-жа."],
        ["l2", "Ёж шёл к кус-там."],
        ["l3", "– Ба-буш-ка, мож-но я возь-му е-жа на ру-ки? – спро-си-ла Ка-тя."],
        ["l4", "– Нет, Ка-тя. Е-жа нель-зя брать в ру-ки. О-н жи-вёт в са-ду, – ска-за-ла ба-буш-ка."],
        ["l5", "– А мож-но на не-го по-смот-реть? – спро-си-ла Ка-тя."],
        ["l6", "– Мож-но. Толь-ко из-да-ле-ка, – ска-за-ла ба-буш-ка."],
        ["l7", "Ка-тя ти-хо смот-ре-ла на е-жа."],
        ["l8", "Ёж ушёл в кус-ты."],
        ["l9", "Ди-ких жи-вот-ных нель-зя брать в ру-ки!"],
      ]),
    },
    {
      id: "tidy_toys",
      kind: "story",
      title: { ru: "Убираем игрушки", en: "Tidying Up Toys" },
      image: "media/tidy_toys.webp",
      level: 1,
      lines: makeLines([
        ["l1", "Ут-ром На-дя при-шла к Ми-ше в гос-ти."],
        ["l2", "О-ни иг-ра-ли и стро-и-ли баш-ню из ку-би-ков."],
        ["l3", "Ко-гда иг-ра за-кон-чи-лась, ку-би-ки ос-та-лись на по-лу."],
        ["l4", "– На-дя, да-вай у-бе-рём ку-би-ки, – ска-зал Ми-ша.", { newParagraph: true }],
        ["l5", "– Давай. Ты у-бе-рёшь крас-ные, а я – си-ние, – ска-за-ла На-дя."],
        ["l6", "Де-ти сло-жи-ли все ку-би-ки в я-щик.", { newParagraph: true }],
        ["l7", "В ком-на-те ста-ло чис-то."],
        ["l8", "По-сле иг-ры иг-руш-ки нуж-но у-би-рать!"],
      ]),
    },
    {
      id: "red_pencil",
      kind: "story",
      title: { ru: "Карандаш Пети", en: "Petya's Pencil" },
      image: "media/red_pencil.webp",
      level: 1,
      lines: makeLines([
        ["l1", "На у-ро-ке ри-со-ва-ния Да-ша от-кры-ла пе-нал."],
        ["l2", "В пе-на-ле не бы-ло крас-но-го ка-ран-да-ша."],
        ["l3", "Да-ша рас-стро-и-лась."],
        ["l4", "– Пе-тя, мож-но взять твой крас-ный ка-ран-даш? – спро-си-ла Да-ша.", { newParagraph: true }],
        ["l5", "– Мож-но. Толь-ко вер-ни е-го по-сле у-ро-ка, – ска-зал Пе-тя."],
        ["l6", "Да-ша на-ри-со-ва-ла цве-ток."],
        ["l7", "По-сле у-ро-ка о-на вер-ну-ла Пе-те ка-ран-даш."],
        ["l8", "– Спа-си-бо, Пе-тя."],
        ["l9", "– По-жа-луй-ста, – ска-зал Пе-тя."],
        ["l10", "Чу-жие ве-щи нуж-но брать с раз-ре-ше-ния и воз-вра-щать!"],
      ]),
    },
    {
      id: "zebra_crossing",
      kind: "story",
      title: { ru: "Переход", en: "The Crossing" },
      image: "media/zebra_crossing.webp",
      level: 1,
      lines: makeLines([
        ["l1", "Се-рё-жа и па-па е-ха-ли на ве-ло-си-пе-дах."],
        ["l2", "У пе-ше-ход-но-го пе-ре-хо-да о-ни ос-та-но-ви-лись на крас-ный свет све-то-фо-ра."],
        ["l3", "– Се-рё-жа, с ве-ло-си-пе-да нуж-но слезть и вес-ти е-го ря-дом на пе-ре-хо-де, – ска-зал па-па."],
        ["l4", "Се-рё-жа слез с ве-ло-си-пе-да."],
        ["l5", "За-го-рел-ся зе-лё-ный свет для пе-ше-хо-дов."],
        ["l6", "О-ни по-смот-ре-ли по сто-ро-нам и пе-ре-шли до-ро-гу по пе-ре-хо-ду."],
        ["l7", "На дру-гой сто-ро-не Се-рё-жа и па-па сно-ва се-ли на ве-ло-си-пе-ды и по-е-ха-ли даль-ше."],
        ["l8", "До-ро-гу нуж-но пе-ре-хо-дить по пе-ше-ход-но-му пе-ре-хо-ду и на зе-лё-ный свет!"],
      ]),
    },
    {
      id: "cookies",
      kind: "story",
      title: { ru: "Печенье для папы", en: "Cookies for Dad" },
      image: "media/cookies.webp",
      level: 1,
      lines: makeLines([
        ["l1", "В суб-бо-ту О-ля го-то-ви-ла пе-чень-е с ма-мой."],
        ["l2", "Ма-ма сде-ла-ла те-сто, а О-ля ска-та-ла ма-лень-кие ша-ри-ки."],
        ["l3", "О-ни по-ло-жи-ли ша-ри-ки на про-ти-вень."],
        ["l4", "Ма-ма по-ста-ви-ла про-ти-вень в ду-хов-ку."],
        ["l5", "Ско-ро на кух-не за-пах-ло пе-чень-ем."],
        ["l6", "Ко-гда пе-чень-е ос-ты-ло, О-ля по-ло-жи-ла е-го на та-рел-ку."],
        ["l7", "– Па-па, я у-го-щу те-бя пе-чень-ем, – ска-за-ла О-ля."],
        ["l8", "– Спа-си-бо, О-ля. О-чень вкус-но! – ска-зал па-па."],
        ["l9", "О-ле бы-ло при-ят-но у-го-стить па-пу."],
        ["l10", "Па-па был рад."],
      ]),
    },
  ],
};

// Paragraphs mark a change of scene, action, speaker, or final idea. Keeping
// this editorial structure here makes story text easy to scan without changing
// the child-facing wording or the authored syllable breakdown.
const paragraphStartsByStory = {
  whose_ball: ["l4", "l7", "l8", "l9"],
  help_mommy: ["l3", "l4", "l7", "l8"],
  whose_horse: ["l4", "l5", "l6", "l7", "l8"],
  lost_mitten: ["l5", "l6", "l7", "l8", "l9", "l12"],
  bird_feeder: ["l2", "l3", "l4", "l5", "l6", "l10"],
  rainy_walk: ["l4", "l5", "l6", "l9", "l10"],
  planting_flower: ["l3", "l4", "l8", "l10"],
  hedgehog: ["l3", "l4", "l5", "l6", "l7", "l9"],
  tidy_toys: ["l4", "l5", "l6", "l8"],
  red_pencil: ["l4", "l5", "l6", "l8", "l9", "l10"],
  zebra_crossing: ["l3", "l4", "l6", "l7", "l8"],
  cookies: ["l6", "l7", "l8", "l9"],
};

for (const story of manifest.texts) {
  const starts = new Set(paragraphStartsByStory[story.id] ?? []);
  for (const line of story.lines) {
    if (starts.has(line.id)) line.newParagraph = true;
    else delete line.newParagraph;
  }
}

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
writeFileSync("public/decks/reading_short_stories_v1.5.2.zip", buffer);
console.log("\nZIP written to public/decks/reading_short_stories_v1.5.2.zip");
