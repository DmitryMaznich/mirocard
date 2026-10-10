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
