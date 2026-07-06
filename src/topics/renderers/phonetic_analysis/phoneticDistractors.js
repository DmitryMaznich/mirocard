import { shuffle } from "@/shared/utils/shuffle";

// Логопедические пары смешения: звонкие/глухие, свистящие/шипящие, соноры,
// аффрикаты, плюс пары гласных, различаемых по подъёму/ряду (для последнего
// звука в словах вроде "нога", "коза"). Не претендует на исчерпывающую
// фонетику — покрывает пары, которые реально путают дети с ОНР/ФФНР.
export const CONFUSION_PAIRS = {
  б: ["п"], п: ["б"],
  в: ["ф"], ф: ["в"],
  г: ["к"], к: ["г"],
  д: ["т"], т: ["д"],
  ж: ["ш"], ш: ["ж"],
  з: ["с", "ж"], с: ["з", "ш", "ц"],
  ц: ["с", "ч"], ч: ["ц", "щ"], щ: ["ч"],
  л: ["р"], р: ["л"], й: ["л"],
  а: ["о"], о: ["а"],
  ы: ["и"], и: ["ы"],
};

const ALPHABET_POOL = [
  "а", "б", "в", "г", "д", "е", "ж", "з", "и", "й", "к", "л", "м", "н",
  "о", "п", "р", "с", "т", "у", "ф", "х", "ц", "ч", "ш", "щ", "э", "ю", "я",
]; // без ъ/ь — у них нет собственного звука

export function pickDistractorLetters(targetLetter, count) {
  const confusable = (CONFUSION_PAIRS[targetLetter] ?? []).filter((l) => l !== targetLetter);
  const primary = shuffle(confusable)[0];

  // Остальные слоты — случайные буквы вне пары смешения (не дублируем
  // фонетическую путаницу сверх одного целевого дистрактора).
  const excluded = new Set([targetLetter, primary, ...confusable]);
  const randomPool = ALPHABET_POOL.filter((l) => !excluded.has(l));
  const remainingCount = count - (primary ? 1 : 0);
  const randomPicks = shuffle(randomPool).slice(0, remainingCount);

  return shuffle([primary, ...randomPicks].filter(Boolean));
}
