// Unlike a single digit 0-9 (identify_number's counter, which
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
  if (n % 100 >= 11 && n % 100 <= 14) return "десятков";
  const mod10 = n % 10;
  if (mod10 === 1) return "десяток";
  if (mod10 >= 2 && mod10 <= 4) return "десятка";
  return "десятков";
}

export function pluralOnes(n) {
  if (n % 100 >= 11 && n % 100 <= 14) return "единиц";
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

// IdentifyNumberTask's own recap: this mode asks "Какое это число?", so
// the answer reads decomposition-first, number-second — the reverse of
// placeValueSentence's order, which fits BuildNumberTask's opposite
// direction (parts already confirmed, revealing the number they make).
// Digits throughout (not spelled-out words) — this screen is teaching
// place value, not Russian numerals.
export function placeValueAnswerSentence(tens, ones, number) {
  return `${tens} ${pluralTens(tens)} и ${ones} ${pluralOnes(ones)} — это ${number}`;
}

const UNIT_WORDS = ["ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEEN_WORDS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS_WORDS = ["", "десять", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];

const HUNDRED_WORDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

export function pluralHundreds(n) {
  if (n % 100 >= 11 && n % 100 <= 14) return "сотен";
  const mod10 = n % 10;
  if (mod10 === 1) return "сотня";
  if (mod10 >= 2 && mod10 <= 4) return "сотни";
  return "сотен";
}

// 0..999 spelled out, for the spoken model «2 десятка и 7 единиц — двадцать семь».
export function numberWords(n) {
  if (n >= 100) {
    const rest = n % 100;
    return rest ? `${HUNDRED_WORDS[Math.floor(n / 100)]} ${numberWords(rest)}` : HUNDRED_WORDS[Math.floor(n / 100)];
  }
  if (n < 10) return UNIT_WORDS[n];
  if (n < 20) return TEEN_WORDS[n - 10];
  const tens = Math.floor(n / 10), ones = n % 10;
  return ones ? `${TENS_WORDS[tens]} ${UNIT_WORDS[ones]}` : TENS_WORDS[tens];
}

// The one speech pattern every place-value answer ends with. Zero ones are
// named on purpose («3 десятка и 0 единиц») — that's the placeholder zero.
export function placeValuePhrase(n) {
  if (n >= 100) {
    // Zero places are named too («3 сотни, 0 десятков и 5 единиц») — the
    // placeholder zero is exactly what 305 is about.
    const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10;
    return `${h} ${pluralHundreds(h)}, ${t} ${pluralTens(t)} и ${o} ${pluralOnes(o)} — ${numberWords(n)}`;
  }
  const tens = Math.floor(n / 10), ones = n % 10;
  const parts = tens ? `${tens} ${pluralTens(tens)} и ${ones} ${pluralOnes(ones)}` : `${ones} ${pluralOnes(ones)}`;
  return `${parts} — ${numberWords(n)}`;
}

// «3 сотни, 0 десятков и 5 единиц» / «4 десятка и 14 единиц» — what was put
// on the board, for the check's list of mistakes.
export function spelledPlaces({ hundreds, tens, ones }) {
  const parts = [
    ...(hundreds !== undefined ? [`${hundreds} ${pluralHundreds(hundreds)}`] : []),
    `${tens} ${pluralTens(tens)}`,
    `${ones} ${pluralOnes(ones)}`,
  ];
  return `${parts.slice(0, -1).join(", ")} и ${parts[parts.length - 1]}`;
}
