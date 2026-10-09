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
export const PROPIS_PHONEME_ENTRIES = [
  ...PHONEME_LETTERS.map(([letter, phoneme, sound], index) => ({
    key: `sound_${letter}`, letter, phoneme, text: phoneme ? letter : sound,
    label: `${letter.toUpperCase()} — ${phoneme ? `звук [${sound}]` : sound}`,
    category: phoneme ? "Звуки" : "Знаки", order: index,
  })),
  { key: "case_upper", text: "заглавная", label: "Заглавная", category: "Регистр", order: 33 },
  { key: "case_lower", text: "строчная", label: "Строчная", category: "Регистр", order: 34 },
];
export function phonemeInput(entry) {
  return entry.phoneme
    ? { ssml: `<speak><phoneme alphabet="x-sampa" ph="${entry.phoneme}">${entry.letter}</phoneme></speak>` }
    : { text: entry.text };
}
