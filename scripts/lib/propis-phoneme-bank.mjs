// X-SAMPA phonemes supported for ru-RU:
// https://cloud.google.com/text-to-speech/docs/phonemes#russian_russia_ru-ru
// E/Ё/Ю/Я in isolation denote the initial й + vowel sequence. Signs have no sound.
export const PHONEME_LETTERS = [
  ["а", "a", "а"], ["б", "b", "б"], ["в", "v", "в"], ["г", "g", "г"], ["д", "d", "д"],
  ["е", "je", "йэ"], ["ё", "jo", "йо"], ["ж", "Z", "ж"], ["з", "z", "з"], ["и", "i", "и"],
  ["й", "j", "й"], ["к", "k", "к"], ["л", "l", "л"], ["м", "m", "м"], ["н", "n", "н"],
  ["о", "o", "о"], ["п", "p", "п"], ["р", "r", "р"], ["с", "s", "с"], ["т", "t", "т"],
  ["у", "u", "у"], ["ф", "f", "ф"], ["х", "x", "х"], ["ц", "ts", "ц"], ["ч", "tS_j", "ч"],
  ["ш", "S", "ш"], ["щ", "S_j", "щ"], ["ъ", null, "твёрдый знак"], ["ы", "1", "ы"],
  ["ь", null, "мягкий знак"], ["э", "e", "э"], ["ю", "ju", "йу"], ["я", "ja", "йа"],
];
// Audited boundaries for the preserved WaveNet-A syllables (rate 0.7).
// A consonant-only SSML phoneme silently fell back to a letter name.
export const CONSONANT_CLIPS = {
  б: [0.075, 0.267], в: [0.075, 0.235], г: [0.075, 0.238], д: [0.075, 0.255],
  ж: [0.075, 0.305], з: [0.08, 0.315], й: [0.08, 0.225], к: [0.10, 0.222],
  л: [0.075, 0.195], м: [0.07, 0.20], н: [0.075, 0.205], п: [0.10, 0.192],
  р: [0.065, 0.18], с: [0.08, 0.375], т: [0.12, 0.214], ф: [0.08, 0.320],
  х: [0.08, 0.345], ц: [0.12, 0.35], ч: [0.10, 0.325], ш: [0.08, 0.375],
  щ: [0.08, 0.36],
};
export const PROPIS_PHONEME_ENTRIES = [
  ...PHONEME_LETTERS.map(([letter, phoneme, sound], index) => ({
    key: `sound_${letter}`, letter, phoneme, text: phoneme ? letter : sound,
    clip: CONSONANT_CLIPS[letter],
    label: `${letter.toUpperCase()} — ${phoneme ? `звук [${sound}]` : sound}`,
    category: phoneme ? "Звуки" : "Знаки", order: index,
  })),
  { key: "case_upper", text: "заглавная", label: "Заглавная", category: "Регистр", order: 33 },
  { key: "case_lower", text: "строчная", label: "Строчная", category: "Регистр", order: 34 },
];
export function phonemeInput(entry) {
  // Consonants are extracted from preserved syllables; vowels can use SSML.
  return entry.clip
    ? { text: entry.letter === "й" ? "я" : `${entry.letter}а` }
    : entry.phoneme
    ? { ssml: `<speak><phoneme alphabet="x-sampa" ph="${entry.phoneme}">${entry.letter}</phoneme></speak>` }
    : { text: entry.text };
}
