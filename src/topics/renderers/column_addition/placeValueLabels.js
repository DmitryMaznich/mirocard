export function pluralTens(n) {
  return n === 1 ? "десяток" : n >= 2 && n <= 4 ? "десятка" : "десятков";
}

export function pluralOnes(n) {
  return n === 1 ? "единица" : n >= 2 && n <= 4 ? "единицы" : "единиц";
}

// Unlike pluralTens/pluralOnes (always a single digit 0-9 in this app, so
// the 11-14 exception never actually comes up), build_number's raw coin
// count is the FULL target number (up to maxTens*10+maxOnes, e.g. 28 or
// 14) — so this one does need the teen-number exception, or "14 монеты"
// would come out instead of "14 монет".
export function pluralCoins(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "монет";
  const mod10 = n % 10;
  if (mod10 === 1) return "монету";
  if (mod10 >= 2 && mod10 <= 4) return "монеты";
  return "монет";
}
