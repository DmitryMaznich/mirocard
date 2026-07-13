export function pluralTens(n) {
  return n === 1 ? "десяток" : n >= 2 && n <= 4 ? "десятка" : "десятков";
}

export function pluralOnes(n) {
  return n === 1 ? "единица" : n >= 2 && n <= 4 ? "единицы" : "единиц";
}
