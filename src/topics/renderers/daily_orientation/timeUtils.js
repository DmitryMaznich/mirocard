export const HOUR_WORDS = [
  "ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять",
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать",
  "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать", "двадцать", "двадцать один",
  "двадцать два", "двадцать три",
];

export const MINUTE_WORDS = [
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

export const WEEKDAY_NAMES = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
export const WEEKDAY_PAST_VERB = ["было", "был", "был", "была", "был", "была", "была"];

export const DATE_ORDINALS = [
  "первое", "второе", "третье", "четвёртое", "пятое", "шестое", "седьмое", "восьмое", "девятое", "десятое",
  "одиннадцатое", "двенадцатое", "тринадцатое", "четырнадцатое", "пятнадцатое", "шестнадцатое", "семнадцатое",
  "восемнадцатое", "девятнадцатое", "двадцатое", "двадцать первое", "двадцать второе", "двадцать третье",
  "двадцать четвёртое", "двадцать пятое", "двадцать шестое", "двадцать седьмое", "двадцать восьмое",
  "двадцать девятое", "тридцатое", "тридцать первое",
];

export const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

// All Russian month names are masculine, unlike weekdays/seasons -- no
// per-month past-tense table is needed, "был"/"будет" always apply.
export const MONTHS_NOMINATIVE = [
  "январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

export const SEASON_WORDS = { winter: "зима", spring: "весна", summer: "лето", autumn: "осень" };
export const SEASON_PAST_VERB = { winter: "была", spring: "была", summer: "было", autumn: "была" };

export function russianPlural(value, singular, few, many) {
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

// Parts of the day follow the child's own routine at the edges -- "ночь" is
// when they sleep, not a fixed 23:00 -- and fixed noon/18:00 in the middle,
// since those line up with lunch and dinner for most families anyway.
export const DAYPARTS = [
  { id: "morning", label: "УТРО" },
  { id: "day", label: "ДЕНЬ" },
  { id: "evening", label: "ВЕЧЕР" },
  { id: "night", label: "НОЧЬ" },
];
export const DEFAULT_WAKE_HOUR = 7;
export const DEFAULT_BED_HOUR = 21;
const DAY_START_HOUR = 12;
const EVENING_START_HOUR = 18;

export function getDaypartId(date, wakeHour = DEFAULT_WAKE_HOUR, bedHour = DEFAULT_BED_HOUR) {
  const hour = date.getHours();
  if (hour >= bedHour || hour < wakeHour) return "night";
  if (hour < DAY_START_HOUR) return "morning";
  if (hour < EVENING_START_HOUR) return "day";
  return "evening";
}

export function getSpokenDaypart(daypartId) {
  const label = DAYPARTS.find((part) => part.id === daypartId)?.label ?? "";
  return `Сейчас ${label.toLowerCase()}.`;
}

// Split into the hour half and the minute half so the time card can colour
// each half to match its own clock hand and digital-clock digits. On the hour
// the minute half is "ровно" -- "десять часов ноль минут" is technically
// correct but nobody says it, and it's the version a child will hear from
// adults.
export function getClockWordParts(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return {
    hour: `${HOUR_WORDS[hours]} ${russianPlural(hours, "час", "часа", "часов")}`,
    minute: minutes === 0
      ? "ровно"
      : `${MINUTE_WORDS[minutes]} ${russianPlural(minutes, "минута", "минуты", "минут")}`,
  };
}

function buildClockWords(date) {
  const { hour, minute } = getClockWordParts(date);
  return `${hour} ${minute}`;
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

export function getSpokenMonth(date, offset) {
  const name = MONTHS_NOMINATIVE[date.getMonth()];
  if (offset < 0) return `Вчера был ${name}.`;
  if (offset > 0) return `Завтра будет ${name}.`;
  return `Сейчас ${name}.`;
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

// ── Helpers for the concept modals (ConceptModals.jsx) ──────────────

// Monday-first, keyed by Date#getDay() like WEEKDAY_NAMES. Full names are
// the primary label everywhere; the short form is only a secondary caption.
export const WEEK_MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0].map((day) => ({
  day,
  name: WEEKDAY_NAMES[day],
  short: ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][day],
  weekend: day === 0 || day === 6,
}));

// Months of each season, in the order they come (winter spans the new year).
export const SEASON_ORDER = ["winter", "spring", "summer", "autumn"];
export const SEASON_MONTHS = {
  winter: [11, 0, 1],
  spring: [2, 3, 4],
  summer: [5, 6, 7],
  autumn: [8, 9, 10],
};

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function daysWord(count) {
  return `${count} ${russianPlural(count, "день", "дня", "дней")}`;
}

// "сентябрь" / "сентября" -> { stem: "сентябр", nominativeEnding: "ь",
// genitiveEnding: "я" }: what changes when the month follows a number
// ("29 сентября"), so the modal can highlight exactly that part.
export function monthEndingChange(monthIndex) {
  const nominative = MONTHS_NOMINATIVE[monthIndex];
  const genitive = MONTHS_GENITIVE[monthIndex];
  let common = 0;
  while (common < nominative.length && nominative[common] === genitive[common]) common++;
  return {
    stem: nominative.slice(0, common),
    nominativeEnding: nominative.slice(common),
    genitiveEnding: genitive.slice(common),
  };
}


// ── Разговорное время ("двадцать минут десятого") ──────────────────
// The way time is said at home, on a 12-hour clock: past the hour it counts
// toward the next one ("пять минут десятого", "четверть десятого",
// "половина десятого"), after half it counts what's left ("без двадцати
// десять", "без четверти десять"). Split into the minute half and the hour
// half like getClockWordParts, so the card can keep the hand colours -- but
// here the minute half comes first.

const HOUR12_NOMINATIVE = ["двенадцать", "час", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять", "одиннадцать", "двенадцать"];
const HOUR12_ORDINAL_GENITIVE = ["двенадцатого", "первого", "второго", "третьего", "четвёртого", "пятого", "шестого", "седьмого", "восьмого", "девятого", "десятого", "одиннадцатого", "двенадцатого"];
const GENITIVE_UNITS = ["", "одной", "двух", "трёх", "четырёх", "пяти", "шести", "семи", "восьми", "девяти", "десяти", "одиннадцати", "двенадцати", "тринадцати", "четырнадцати", "пятнадцати", "шестнадцати", "семнадцати", "восемнадцати", "девятнадцати"];

function genitiveNumber(value) {
  if (value < 20) return GENITIVE_UNITS[value];
  return value % 10 ? `двадцати ${GENITIVE_UNITS[value % 10]}` : "двадцати";
}

// "одна минута" -> "одну минуту" after "N минут(у) десятого".
function accusativeMinutes(value) {
  const word = MINUTE_WORDS[value].replace(/одна$/, "одну");
  return `${word} ${russianPlural(value, "минуту", "минуты", "минут")}`;
}

export function getSpokenClockWordParts(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hour12 = hours % 12 || 12;
  const next12 = (hours + 1) % 12 || 12;
  if (minutes === 0) {
    return { minute: "ровно", hour: hour12 === 1 ? "час" : `${HOUR12_NOMINATIVE[hour12]} ${russianPlural(hour12, "час", "часа", "часов")}` };
  }
  if (minutes === 15) return { minute: "четверть", hour: HOUR12_ORDINAL_GENITIVE[next12] };
  if (minutes === 30) return { minute: "половина", hour: HOUR12_ORDINAL_GENITIVE[next12] };
  if (minutes < 30) return { minute: accusativeMinutes(minutes), hour: HOUR12_ORDINAL_GENITIVE[next12] };
  const left = 60 - minutes;
  if (left === 15) return { minute: "без четверти", hour: HOUR12_NOMINATIVE[next12] };
  const leftWords = left % 5 === 0
    ? `без ${genitiveNumber(left)}`
    : `без ${genitiveNumber(left)} ${left % 10 === 1 && left !== 11 ? "минуты" : "минут"}`;
  return { minute: leftWords, hour: HOUR12_NOMINATIVE[next12] };
}

// "ровно" goes after the hour ("девять часов ровно"); everything else
// before it ("двадцать минут десятого", "без пяти десять").
export function spokenClockSentence(date) {
  const { minute, hour } = getSpokenClockWordParts(date);
  return minute === "ровно" ? `${hour} ровно` : `${minute} ${hour}`;
}

// A plan entry may start with a picture: "🏫 Школа". The settings screen
// puts it there; the week modal and the Вчера/Завтра card show it big.
const LEADING_ICON = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*/u;

// The text is returned untrimmed: the settings input edits it live, and
// trimming would eat a space the moment it's typed.
export function splitPlanIcon(entry) {
  const value = String(entry ?? "");
  const match = LEADING_ICON.exec(value.trimStart());
  return match ? { icon: match[1], text: value.trimStart().slice(match[0].length) } : { icon: null, text: value };
}
