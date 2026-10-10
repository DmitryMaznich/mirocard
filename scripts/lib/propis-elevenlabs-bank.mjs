// ElevenLabs take on the propis letter dictation (2026-10-10): the owner's
// cloned voice «Дмитрий Мазниченко», model eleven_v4, the same friendly,
// unhurried delivery approved for «Рисуем по клеткам». Two takes per key:
// <key>.mp3 and <key>__2.mp3 in public/audio/propis-elevenlabs-review, for
// review in /audio-review.html before anything replaces public/audio/propis-dictation.
// Consonants are prompted as isolated sounds (continuants drawn out, e.g.
// "Сссс."), vowels as the letter in quotes, Ъ/Ь by name.
const STYLE = "[friendly] [unhurried]";
const SOUND = "[only the isolated consonant sound, no vowel after it]";

const LETTERS = [
  ["а", "vowel", "«А»."], ["б", "stop", "б"], ["в", "long", "Вввв."], ["г", "stop", "г"],
  ["д", "stop", "д"], ["е", "vowel", "«Е»."], ["ё", "vowel", "«Ё»."], ["ж", "long", "Жжжж."],
  ["з", "long", "Зззз."], ["и", "vowel", "«И»."], ["й", "long", "Йййй."], ["к", "stop", "к"],
  ["л", "long", "Лллл."], ["м", "long", "Мммм."], ["н", "long", "Нннн."], ["о", "vowel", "«О»."],
  ["п", "stop", "п"], ["р", "long", "Рррр."], ["с", "long", "Сссс."], ["т", "stop", "т"],
  ["у", "vowel", "«У»."], ["ф", "long", "Фффф."], ["х", "long", "Хххх."], ["ц", "stop", "ц"],
  ["ч", "stop", "ч"], ["ш", "long", "Шшшш."],
  ["щ", "soft", "Щщщщ."], ["ъ", "name", "Твёрдый знак."], ["ы", "vowel", "«Ы»."],
  ["ь", "name", "Мягкий знак."], ["э", "vowel", "«Э»."], ["ю", "vowel", "«Ю»."], ["я", "vowel", "«Я»."],
];

function prompt(kind, text) {
  if (kind === "stop" || kind === "long") return `${STYLE} ${SOUND} ${text}`;
  if (kind === "soft") return `${STYLE} [only the isolated soft consonant sound, no vowel after it] ${text}`;
  return `${STYLE} ${text}`;
}

export const PROPIS_ELEVENLABS_ENTRIES = [
  ...LETTERS.map(([letter, kind, text], order) => ({
    key: `sound_${letter}`, prompt: prompt(kind, text), order,
    label: kind === "name" ? `${letter.toUpperCase()} — ${text.replace(".", "").toLowerCase()}` : `${letter.toUpperCase()} — звук`,
    category: kind === "name" ? "Знаки" : kind === "vowel" ? "Гласные" : "Согласные",
  })),
  { key: "case_upper", prompt: `${STYLE} Заглавная`, order: 33, label: "Заглавная", category: "Регистр" },
  { key: "case_lower", prompt: `${STYLE} Строчная`, order: 34, label: "Строчная", category: "Регистр" },
];
