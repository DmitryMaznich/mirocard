const HOUR_WORDS = [
  "ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять",
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать",
  "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать", "двадцать", "двадцать один",
  "двадцать два", "двадцать три",
];

const MINUTE_WORDS = [
  "ноль", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять",
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать",
  "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать", "двадцать", "двадцать одна",
  "двадцать две", "двадцать три", "двадцать четыре", "двадцать пять", "двадцать шесть",
  "двадцать семь", "двадцать восемь", "двадцать девять", "тридцать", "тридцать одна",
  "тридцать две", "тридцать три", "тридцать четыре", "тридцать пять", "тридцать шесть",
  "тридцать семь", "тридцать восемь", "тридцать девять", "сорок", "сорок одна", "сорок две",
  "сорок три", "сорок четыре", "сорок пять", "сорок шесть", "сорок семь", "сорок восемь",
  "сорок девять", "пятьдесят", "пятьдесят одна", "пятьдесят две", "пятьдесят три",
  "пятьдесят четыре", "пятьдесят пять", "пятьдесят шесть", "пятьдесят семь", "пятьдесят восемь",
  "пятьдесят девять",
];

function russianPlural(value, singular, few, many) {
  const remainder = Math.abs(value) % 100;
  const last = remainder % 10;
  if (remainder > 10 && remainder < 20) return many;
  if (last === 1) return singular;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export function addCalendarDays(date, offset) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset, 12);
}

export function getSeason(monthIndex) {
  if ([11, 0, 1].includes(monthIndex)) return { id: "winter", label: "ЗИМА" };
  if ([2, 3, 4].includes(monthIndex)) return { id: "spring", label: "ВЕСНА" };
  if ([5, 6, 7].includes(monthIndex)) return { id: "summer", label: "ЛЕТО" };
  return { id: "autumn", label: "ОСЕНЬ" };
}

export function getRelativePrompt(offset, noun) {
  if (noun === "day") {
    if (offset < 0) return "Какой был день?";
    if (offset > 0) return "Какой будет день?";
    return "Какой сегодня день?";
  }
  if (offset < 0) return "Какое было время года?";
  if (offset > 0) return "Какое будет время года?";
  return "Какое сейчас время года?";
}

export function formatRussianClockTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${HOUR_WORDS[hours]} ${russianPlural(hours, "час", "часа", "часов")} ${MINUTE_WORDS[minutes]} ${russianPlural(minutes, "минута", "минуты", "минут")}`.toUpperCase();
}

export function formatDigitalClock(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatDisplayDate(date) {
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(date);
  const month = new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(date);
  return {
    weekday: weekday.toLocaleUpperCase("ru-RU"),
    month: month.toLocaleUpperCase("ru-RU"),
    dayOfMonth: `${date.getDate()}-е`,
  };
}
