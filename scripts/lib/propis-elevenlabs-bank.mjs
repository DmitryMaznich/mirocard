// ElevenLabs take on the propis letter dictation: the owner's cloned voice
// «Дмитрий Мазниченко», model eleven_v4. Two takes per key — <key>.mp3 and
// <key>__2.mp3 in public/audio/propis-elevenlabs-review — for review in
// /audio-review.html before anything replaces public/audio/propis-dictation.
//
// Round 2 (2026-10-10, owner's call after round 1 was rejected): a plain
// drawn-out letter, no audio tags at all. Round 1's [friendly]/[unhurried]/
// "[only the isolated consonant sound…]" tags produced breathy, Gemini-like
// clips; repeating the letter ("Ссссс.") asks for a longer sound instead.
const LETTERS = [
  ["а", "Ааааа."], ["б", "Ббббб."], ["в", "Ввввв."], ["г", "Ггггг."], ["д", "Ддддд."],
  ["е", "Еееее."], ["ё", "Ёёёёё."], ["ж", "Жжжжж."], ["з", "Ззззз."], ["и", "Иииии."],
  ["й", "Йййййй."], ["к", "Ккккк."], ["л", "Ллллл."], ["м", "Ммммм."], ["н", "Ннннн."],
  ["о", "Ооооо."], ["п", "Ппппп."], ["р", "Ррррр."], ["с", "Ссссс."], ["т", "Ттттт."],
  ["у", "Ууууу."], ["ф", "Ффффф."], ["х", "Ххххх."], ["ц", "Ццццц."], ["ч", "Ччччч."],
  ["ш", "Шшшшш."], ["щ", "Щщщщщ."], ["ъ", "Твёрдый знак."], ["ы", "Ыыыыы."],
  ["ь", "Мягкий знак."], ["э", "Эээээ."], ["ю", "Юююююю."], ["я", "Яяяяя."],
];
const VOWELS = new Set([..."аеёиоуыэюя"]);

export const PROPIS_ELEVENLABS_ENTRIES = [
  ...LETTERS.map(([letter, prompt], order) => {
    const isSign = letter === "ъ" || letter === "ь";
    return {
      key: `sound_${letter}`, prompt, order,
      label: isSign ? `${letter.toUpperCase()} — ${prompt.replace(".", "").toLowerCase()}` : `${letter.toUpperCase()} — звук`,
      category: isSign ? "Знаки" : VOWELS.has(letter) ? "Гласные" : "Согласные",
    };
  }),
  { key: "case_upper", prompt: "Заглавная", order: 33, label: "Заглавная", category: "Регистр" },
  { key: "case_lower", prompt: "Строчная", order: 34, label: "Строчная", category: "Регистр" },
];

// Pilot (2026-10-10, owner's request): Б, В, Г paired with Э, four shapes each,
// to compare against the drawn-out letters above. Two takes per key in
// public/audio/propis-elevenlabs-e-pilot, no audio tags.
const E_PILOT_LETTERS = [["b", "Б"], ["v", "В"], ["g", "Г"]];
const E_PILOT_SHAPES = [
  ["e", (u) => `${u}э.`],
  ["eeee", (u) => `${u}ээээ.`],
  ["lead", (u) => `${u}${u.toLowerCase()}${u.toLowerCase()}э.`],
  ["x3", (u) => `${u}э, ${u.toLowerCase()}э, ${u.toLowerCase()}э.`],
];
export const PROPIS_ELEVENLABS_E_PILOT = E_PILOT_LETTERS.flatMap(([latin, letter], li) =>
  E_PILOT_SHAPES.map(([shape, make], si) => ({
    key: `${latin}_${shape}`, prompt: make(letter), order: li * E_PILOT_SHAPES.length + si,
    label: `${letter}: «${make(letter)}»`, category: letter,
  })));

// Pilot (2026-10-10, owner's request): just let the voice say alphabet letters
// the way it normally would. "А, Б, В, Г, Д." in one breath (four takes,
// row_1..4) and each letter on its own ("Б." — b / b__2, etc.). No tags.
export const PROPIS_ELEVENLABS_ALPHABET = [
  ...[1, 2, 3, 4].map((n) => ({ key: `row_${n}`, prompt: "А, Б, В, Г, Д.", label: `«А, Б, В, Г, Д.» — дубль ${n}`, category: "Подряд", order: n - 1 })),
  ...[["b", "Б"], ["v", "В"], ["g", "Г"], ["d", "Д"]].flatMap(([latin, letter], i) => [
    { key: latin, prompt: `${letter}.`, label: `«${letter}.» — дубль 1`, category: "По одной", order: 4 + i * 2 },
    { key: `${latin}__2`, prompt: `${letter}.`, label: `«${letter}.» — дубль 2`, category: "По одной", order: 5 + i * 2 },
  ]),
];

// Pilot (2026-10-10, owner's decision): the case word stays in the same clip as
// the letter — "Заглавная Б." / "Строчная б." — two files per letter (Ъ/Ь will
// differ). Sample: Б, В, Г, Д + vowels Е, И, У, two takes each, with a
// dictation-style direction tag. Files: public/audio/propis-elevenlabs-case-pilot.
const CASE_PILOT_TAG = "[calm, clear, like a teacher dictating to a class]";
export const PROPIS_ELEVENLABS_CASE_PILOT = [["b", "Б"], ["v", "В"], ["g", "Г"], ["d", "Д"], ["e", "Е"], ["i", "И"], ["u", "У"]]
  .flatMap(([latin, letter], i) => [
    { key: `up_${latin}`, prompt: `${CASE_PILOT_TAG} Заглавная ${letter}.`, label: `Заглавная ${letter}`, category: letter, order: i * 2 },
    { key: `lo_${latin}`, prompt: `${CASE_PILOT_TAG} Строчная ${letter.toLowerCase()}.`, label: `Строчная ${letter.toLowerCase()}`, category: letter, order: i * 2 + 1 },
  ]);

// Pilot (2026-10-10): dictation WORDS in the same voice and delivery as the
// approved letter clips — one utterance per file ("Мама."), the on-screen
// repeat button replays it. 14 words picked for spread (short/long, ё, щ, ь,
// a name, a number word), two takes each. Files:
// public/audio/propis-elevenlabs-words-pilot/word_<id>.mp3 (+ __2), keyed like
// wordDictationKey so an approved take can be copied into propis-dictation as is.
export const PROPIS_ELEVENLABS_WORDS_PILOT = [
  ["w001", "Мама"], ["w006", "Лес"], ["w020", "Полёт"], ["w025", "Лапша"], ["w027", "Плащ"],
  ["w028", "Поэт"], ["w043", "Тимоша"], ["w049", "Ёж"], ["w054", "Ключ"], ["w069", "Дверь"],
  ["w088", "Медведь"], ["w101", "Муравей"], ["w204", "Велосипед"], ["w233", "Четыре"],
].map(([id, word], order) => ({ key: `word_${id}`, prompt: `${CASE_PILOT_TAG} ${word}.`, label: word, category: "Слова", order }));
