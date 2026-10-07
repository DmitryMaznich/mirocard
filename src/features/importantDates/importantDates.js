import { pluralRu } from "@/shared/utils/format";

// A child's important dates: birthdays (their own and close people's),
// holidays and one-off events ("Идём в новую школу"). Kept on the student
// record next to My People and shown by the "Сегодня" screen: a festive look
// on the day itself and a countdown in the days before it.
//
// A card:
//   { id, type, title, day, month (1-12), year|null, repeat: "yearly"|"once",
//     icon, photo|null, personId|null, countdownDays: 0|3|7|14, enabled,
//     presetId|null, createdAt, updatedAt, deletedAt }
// `year` means the birth year for a birthday (optional, gives the age) and
// the actual year of a one-off event (required for "once").

export const DATE_TYPES = [
  { id: "birthday", label: "День рождения", icon: "🎂" },
  { id: "own_birthday", label: "Мой день рождения", icon: "🎂" },
  { id: "holiday", label: "Праздник", icon: "🎉" },
  { id: "event", label: "Событие", icon: "📅" },
];

export const DATE_ICONS = ["🎂", "🎁", "🎉", "🎄", "🏫", "🔔", "🧳", "✈️", "🏠", "🏥", "🌷", "⭐", "📅"];

export const COUNTDOWN_OPTIONS = [0, 3, 7, 14];
export const DEFAULT_COUNTDOWN_DAYS = 7;

export const OWN_BIRTHDAY_TITLE = "Мой день рождения";

// Fixed-date holidays only: a movable one (Пасха) would need its own
// calculation every year, and a wrong date on a wall display is worse than
// none -- the adult can add it as a one-off event instead.
export const PRESET_HOLIDAYS = [
  { presetId: "new_year", title: "Новый год", day: 1, month: 1, icon: "🎄" },
  { presetId: "christmas", title: "Рождество", day: 7, month: 1, icon: "⭐" },
  { presetId: "feb_23", title: "23 Февраля", day: 23, month: 2, icon: "🎖️" },
  { presetId: "mar_8", title: "8 Марта", day: 8, month: 3, icon: "🌷" },
  { presetId: "victory_day", title: "День Победы", day: 9, month: 5, icon: "🎖️" },
  { presetId: "knowledge_day", title: "День знаний", day: 1, month: 9, icon: "🔔" },
];

export const MONTH_NAMES_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function makeImportantDateId() {
  return `date_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function typeInfo(type) {
  return DATE_TYPES.find((entry) => entry.id === type) ?? DATE_TYPES[3];
}

export function normaliseImportantDate(item) {
  const type = DATE_TYPES.some((entry) => entry.id === item?.type) ? item.type : "event";
  const year = Number.isInteger(Number(item?.year)) && Number(item?.year) > 0 ? Number(item.year) : null;
  return {
    id: item?.id ?? makeImportantDateId(),
    type,
    title: type === "own_birthday" ? OWN_BIRTHDAY_TITLE : String(item?.title ?? ""),
    day: Number(item?.day) || 1,
    month: Number(item?.month) || 1,
    year,
    repeat: item?.repeat === "once" ? "once" : "yearly",
    icon: item?.icon || typeInfo(type).icon,
    photo: typeof item?.photo === "string" && item.photo ? item.photo : null,
    personId: item?.personId ?? null,
    countdownDays: COUNTDOWN_OPTIONS.includes(Number(item?.countdownDays)) ? Number(item.countdownDays) : DEFAULT_COUNTDOWN_DAYS,
    enabled: item?.enabled !== false,
    presetId: item?.presetId ?? null,
    createdAt: item?.createdAt ?? null,
    updatedAt: item?.updatedAt ?? null,
    deletedAt: item?.deletedAt ?? null,
  };
}

export function normaliseImportantDates(list) {
  return Array.isArray(list) ? list.filter((item) => item?.id).map(normaliseImportantDate) : [];
}

// What the "Сегодня" screen may show: saved, switched on, and complete.
export function visibleImportantDates(list) {
  return normaliseImportantDates(list).filter((item) => (
    !item.deletedAt && item.enabled && item.title.trim() && (item.repeat === "yearly" || item.year)
  ));
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// The card's date in a given year, or null if it doesn't happen that year.
// A 29 February birthday is celebrated on 28 February in other years -- a
// child shouldn't go three years without one.
export function occurrenceInYear(item, year) {
  if (item.repeat === "once" && item.year !== year) return null;
  const day = Math.min(item.day, daysInMonth(year, item.month));
  return new Date(year, item.month - 1, day);
}

export function isOnDate(item, date) {
  const occurrence = occurrenceInYear(item, date.getFullYear());
  return Boolean(occurrence) && occurrence.getMonth() === date.getMonth() && occurrence.getDate() === date.getDate();
}

export function eventsOnDate(list, date) {
  return list.filter((item) => isOnDate(item, date));
}

// Whole days from `from` to the card's next occurrence (0 = today), or null
// when there's none left (a one-off event that has passed).
export function daysUntil(item, from) {
  const today = startOfDay(from);
  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    const occurrence = occurrenceInYear(item, year);
    if (occurrence && occurrence >= today) {
      return Math.round((occurrence - today) / 86_400_000);
    }
  }
  return null;
}

export function sortByNextOccurrence(list, from) {
  return [...list].sort((a, b) => {
    const da = daysUntil(a, from);
    const db = daysUntil(b, from);
    if (da === null && db === null) return a.title.localeCompare(b.title, "ru");
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
}

// The nearest card still counting down (1..countdownDays days ahead). Only
// one countdown at a time: two strips of shrinking dots on a wall display
// would compete for the same glance.
export function nearestCountdown(list, from) {
  let best = null;
  for (const item of list) {
    if (!item.countdownDays) continue;
    const left = daysUntil(item, from);
    if (left === null || left < 1 || left > item.countdownDays) continue;
    if (!best || left < best.daysLeft) best = { item, daysLeft: left };
  }
  return best;
}

export function ageOn(item, date) {
  if (!item.year) return null;
  const age = date.getFullYear() - item.year;
  return age > 0 && age < 120 ? age : null;
}

export function yearsWord(count) {
  return `${count} ${pluralRu(count, "год", "года", "лет")}`;
}

export function daysWord(count) {
  return `${count} ${pluralRu(count, "день", "дня", "дней")}`;
}

// A title is written as it reads on its own ("День рождения мамы", "Идём в
// новую школу"); after "Сегодня"/"Завтра" its first letter goes lowercase.
// Holidays keep theirs: "Новый год", "8 Марта" are proper names.
function titleInSentence(item) {
  const title = item.title.trim();
  if (item.type === "holiday") return title;
  return title.charAt(0).toLowerCase() + title.slice(1);
}

// What the ribbon says on the day itself (offset 0) or the day before when
// "Завтра" is selected (offset 1). No verb, so no gender agreement to get
// wrong: "Сегодня день рождения мамы!", "Завтра Новый год!".
export function dayPhrase(item, offset = 0) {
  const lead = offset > 0 ? "Завтра" : "Сегодня";
  if (item.type === "own_birthday") return `${lead} мой день рождения!`;
  return `${lead} ${titleInSentence(item)}!`;
}

export function agePhrase(item, date) {
  if (item.type !== "own_birthday") return null;
  const age = ageOn(item, date);
  return age ? `Мне ${yearsWord(age)}.` : null;
}

// "День рождения мамы — через 3 дня" / "... — завтра!": the title stays in
// its own (nominative) form, so this works for any title the adult types.
export function countdownPhrase(item, daysLeft) {
  const title = item.type === "own_birthday" ? OWN_BIRTHDAY_TITLE : item.title.trim();
  if (daysLeft === 1) return { title, when: "завтра!" };
  return { title, when: `через ${daysWord(daysLeft)}` };
}

export function formatDayMonth(item) {
  return `${item.day} ${MONTH_NAMES_GENITIVE[item.month - 1]}${item.repeat === "once" && item.year ? ` ${item.year}` : ""}`;
}

export function isBirthdayType(item) {
  return item.type === "birthday" || item.type === "own_birthday";
}

// Best-effort genitive of a relation word for prefilling "День рождения
// ___": "мама" -> "мамы", "бабушка Галя" -> "бабушки Гали", "брат" ->
// "брата". Only a suggestion -- the adult sees and can fix the title.
const VELAR_OR_HUSHING = /[гкхжшщч]$/;
function genitiveWord(word) {
  const lower = word.toLowerCase();
  if (/а$/.test(lower)) return word.slice(0, -1) + (VELAR_OR_HUSHING.test(lower.slice(0, -1)) ? "и" : "ы");
  if (/я$/.test(lower)) return word.slice(0, -1) + "и";
  if (/й$/.test(lower)) return word.slice(0, -1) + "я";
  if (/ь$/.test(lower)) return word.slice(0, -1) + "я";
  if (/[бвгджзклмнпрстфхцчшщ]$/.test(lower)) return word + "а";
  return word;
}

export function genitivePhrase(text) {
  return String(text ?? "").trim().split(/\s+/).filter(Boolean).map(genitiveWord).join(" ");
}

export function suggestBirthdayTitle(person) {
  const base = (person?.relation || person?.name || "").trim();
  return base ? `День рождения ${genitivePhrase(base)}` : "";
}

// The picture a card is shown with: its own photo, else the linked
// person's first photo, else its icon.
export function cardPhoto(item, myPeople) {
  if (item.photo) return item.photo;
  if (!item.personId) return null;
  const person = (myPeople ?? []).find((candidate) => candidate.id === item.personId && !candidate.deletedAt);
  return person?.photos?.find(Boolean) ?? null;
}

export function ownBirthdayFromProfile(birthDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate ?? ""));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function isCompleteDraft(item) {
  if (!item.title.trim()) return false;
  if (item.day > daysInMonth(item.repeat === "once" && item.year ? item.year : 2024, item.month)) return false;
  if (item.repeat === "once" && !item.year) return false;
  return true;
}
