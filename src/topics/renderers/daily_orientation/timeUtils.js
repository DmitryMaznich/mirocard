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

const WEEKDAY_NAMES = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const WEEKDAY_PAST_VERB = ["было", "был", "был", "была", "был", "была", "была"];

const DATE_ORDINALS = [
  "первое", "второе", "третье", "четвёртое", "пятое", "шестое", "седьмое", "восьмое", "девятое", "десятое",
  "одиннадцатое", "двенадцатое", "тринадцатое", "четырнадцатое", "пятнадцатое", "шестнадцатое", "семнадцатое",
  "восемнадцатое", "девятнадцатое", "двадцатое", "двадцать первое", "двадцать второе", "двадцать третье",
  "двадцать четвёртое", "двадцать пятое", "двадцать шестое", "двадцать седьмое", "двадцать восьмое",
  "двадцать девятое", "тридцатое", "тридцать первое",
];

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const SEASON_WORDS = { winter: "зима", spring: "весна", summer: "лето", autumn: "осень" };
const SEASON_PAST_VERB = { winter: "была", spring: "была", summer: "было", autumn: "была" };

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

function buildClockWords(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${HOUR_WORDS[hours]} ${russianPlural(hours, "час", "часа", "часов")} ${MINUTE_WORDS[minutes]} ${russianPlural(minutes, "минута", "минуты", "минут")}`;
}

export function formatRussianClockTime(date) {
  return buildClockWords(date).toUpperCase();
}

export function getSpokenWeekday(date, offset) {
  const day = date.getDay();
  const name = WEEKDAY_NAMES[day];
  if (offset < 0) return `Вчера ${WEEKDAY_PAST_VERB[day]} ${name}.`;
  if (offset > 0) return `Завтра будет ${name}.`;
  return `Сегодня ${name}.`;
}

export function getSpokenDate(date, offset) {
  const phrase = `${DATE_ORDINALS[date.getDate() - 1]} ${MONTHS_GENITIVE[date.getMonth()]}`;
  if (offset < 0) return `Вчера было ${phrase}.`;
  if (offset > 0) return `Завтра будет ${phrase}.`;
  return `Сегодня ${phrase}.`;
}

export function getSpokenSeason(date, offset) {
  const season = getSeason(date.getMonth());
  const word = SEASON_WORDS[season.id];
  if (offset < 0) return `Вчера ${SEASON_PAST_VERB[season.id]} ${word}.`;
  if (offset > 0) return `Завтра будет ${word}.`;
  return `Сейчас ${word}.`;
}

export function getSpokenTime(date) {
  return `Сейчас ${buildClockWords(date)}.`;
}

// Keyed to Date#getDay() (0=Sunday..6=Saturday) so callers can look a day's
// plan up directly by an actual date without a separate Monday-first mapping.
const WEEKDAY_PLAN_PREFIXES = [
  { prefix: "пн", day: 1 },
  { prefix: "вт", day: 2 },
  { prefix: "ср", day: 3 },
  { prefix: "чт", day: 4 },
  { prefix: "пт", day: 5 },
  { prefix: "сб", day: 6 },
  { prefix: "вс", day: 0 },
];

export function parseWeeklyPlan(text) {
  const plan = {};
  if (!text) return plan;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const content = line.slice(colonIndex + 1).trim();
    if (!content) continue;
    const match = WEEKDAY_PLAN_PREFIXES.find((entry) => entry.prefix === key);
    if (!match) continue;
    plan[match.day] = content;
  }
  return plan;
}

export function formatDigitalClock(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// Local calendar date as YYYY-MM-DD, deliberately not date.toISOString()
// (which is UTC and can land on the wrong day near local midnight). Used to
// key anything that must reset itself at local midnight rather than at a
// fixed UTC instant (e.g. the child's today-only weather pick).
export function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
