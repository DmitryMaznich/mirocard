// Unlike a single digit 0-9 (identify_number's/regroup_ten's counters, which
// used to need this plural form before the live counter was removed),
// build_number's raw coin count is the FULL target number (up to
// maxTens*10+maxOnes, e.g. 28 or 14) — so this one does need the
// teen-number exception, or "14 монеты" would come out instead of "14 монет".
export function pluralCoins(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "монет";
  const mod10 = n % 10;
  if (mod10 === 1) return "монету";
  if (mod10 >= 2 && mod10 <= 4) return "монеты";
  return "монет";
}

// Shared by every place-value mode with a digit-entry answer step
// (BuildNumberTask, IdentifyNumberTask): direction is purely a function of
// the wrong digit vs the target, no component state involved.
export function hintDirectionFor(guess, target) {
  return guess < target ? "more" : "less";
}

// desyatok/edinitsa max out at 9 (a single digit each — never the teens
// range pluralCoins guards against above), so neither needs that mod100
// 11-14 exception.
export function pluralTens(n) {
  const mod10 = n % 10;
  if (mod10 === 1) return "десяток";
  if (mod10 >= 2 && mod10 <= 4) return "десятка";
  return "десятков";
}

export function pluralOnes(n) {
  const mod10 = n % 10;
  if (mod10 === 1) return "единица";
  if (mod10 >= 2 && mod10 <= 4) return "единицы";
  return "единиц";
}

// The closing recap sentence for both IdentifyNumberTask and
// BuildNumberTask's "done" state — read aloud together by the child and
// the adult (no TTS on these screens, by design), tying the number back to
// the tens/ones it was just confirmed from.
export function placeValueSentence(tens, ones, number) {
  return `${number} — это ${tens} ${pluralTens(tens)} и ${ones} ${pluralOnes(ones)}`;
}

const ONES_WORDS_M = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const ONES_WORDS_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEEN_WORDS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
  "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS_WORDS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];

// Spells a number 0-99 out in Russian words (masculine by default —
// "один", "два" — the form numbers take on their own; `gender: "f"`
// switches the 1/2 forms to "одна"/"две" for agreement with a feminine
// noun, e.g. единица).
function numberWords(n, gender = "m") {
  const ones = gender === "f" ? ONES_WORDS_F : ONES_WORDS_M;
  if (n === 0) return "ноль";
  if (n < 10) return ones[n];
  if (n < 20) return TEEN_WORDS[n - 10];
  const tens = Math.floor(n / 10);
  const rest = n % 10;
  return rest === 0 ? TENS_WORDS[tens] : `${TENS_WORDS[tens]} ${ones[rest]}`;
}

// IdentifyNumberTask's own recap: this mode asks "Какое это число?", so
// the answer reads decomposition-first, number-second — the reverse of
// placeValueSentence's order, which fits BuildNumberTask's opposite
// direction (parts already confirmed, revealing the number they make).
// Spelled-out words throughout (not digit + plural word) so it reads as
// a real sentence, with одна/две agreeing with единица's feminine gender.
export function placeValueAnswerSentence(tens, ones, number) {
  const tensWord = numberWords(tens, "m");
  const onesWord = numberWords(ones, "f");
  return `${tensWord} ${pluralTens(tens)} и ${onesWord} ${pluralOnes(ones)} — это ${numberWords(number, "m")}`;
}
