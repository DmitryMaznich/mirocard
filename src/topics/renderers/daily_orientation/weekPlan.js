import { parseWeeklyPlan, splitPlanIcon } from "./timeUtils.js";

// A day of the weekly plan is a short ordered list of the day's big events
// ("🏫 Школа, 👟 Спорт, 📚 Занимаемся, 🛏️ Спать"). It is still stored as the
// same one-line text per day ("Пн: …" in params.weeklyPlan), items separated
// by commas, each with an optional picture in front -- so plans saved before
// the list editor ("🏫 Школа, спорт") read as items as they are, and an older
// app that only knows the one-line form still shows the whole line.

const ITEM_SEPARATOR = ",";

function cleanText(text) {
  return String(text ?? "").replaceAll(ITEM_SEPARATOR, " ").replace(/\s+/g, " ").trim();
}

// Each item belongs to a part of the day (owner, 2026-11-24): the wall screen
// lays the day out as утро / день / вечер / ночь and follows the clock, so no
// one has to tap «сделали». Stored after the item in square brackets
// («🏫 Школа [утро]»); an item saved without one gets a part from its place in
// the day (see guessDayparts).
export const PLAN_DAYPARTS = ["morning", "day", "evening", "night"];
const DAYPART_WORD = { morning: "утро", day: "день", evening: "вечер", night: "ночь" };
const DAYPART_BY_WORD = Object.fromEntries(Object.entries(DAYPART_WORD).map(([id, word]) => [word, id]));
const DAYPART_TAG = /\s*\[(утро|день|вечер|ночь)\]\s*$/u;
const NIGHT_WORDS = /^(спать|сон|спим|ночь)$/iu;

// Parts for items stored without one: the last of several is ночь (the day
// ends going to bed) unless the day already has its bedtime, the rest spread over утро → вечер in their order
// («Школа, Спорт, Занимаемся, Душ, Спать» → утро, день, вечер, вечер, ночь); a
// «Спать»/«Сон» item is always ночь.
export function guessDayparts(items) {
  const count = items.length;
  const hasBedtime = items.some((item) => item.daypart === "night" || NIGHT_WORDS.test(item.text ?? ""));
  return items.map((item, index) => {
    if (item.daypart) return item;
    if (NIGHT_WORDS.test(item.text ?? "")) return { ...item, daypart: "night" };
    if (!hasBedtime && count > 1 && index === count - 1) return { ...item, daypart: "night" };
    const spread = count > 1 ? Math.round((index * 3) / (count - 1)) : 0;
    return { ...item, daypart: PLAN_DAYPARTS[Math.min(2, spread)] };
  });
}

// Items in the order of the day: by part of the day, then as entered.
export function sortByDaypart(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (PLAN_DAYPARTS.indexOf(a.item.daypart) - PLAN_DAYPARTS.indexOf(b.item.daypart)) || (a.index - b.index))
    .map(({ item }) => item);
}

export function parsePlanItems(dayText) {
  if (!dayText) return [];
  const items = String(dayText)
    .split(ITEM_SEPARATOR)
    .map((part) => {
      const raw = part.trim();
      const tag = DAYPART_TAG.exec(raw);
      const { icon, text } = splitPlanIcon(tag ? raw.slice(0, tag.index) : raw);
      return { icon: icon ?? null, text: cleanText(text), daypart: tag ? DAYPART_BY_WORD[tag[1]] : null };
    })
    .filter((item) => item.text || item.icon);
  return sortByDaypart(guessDayparts(items));
}

export function serializePlanItems(items) {
  return sortByDaypart(guessDayparts((items ?? [])
    .map((item) => ({ icon: item.icon || null, text: cleanText(item.text), daypart: PLAN_DAYPARTS.includes(item.daypart) ? item.daypart : null }))
    .filter((item) => item.text || item.icon)))
    .map((item) => `${item.icon ? `${item.icon} ${item.text}`.trim() : item.text} [${DAYPART_WORD[item.daypart]}]`)
    .join(`${ITEM_SEPARATOR} `);
}

export function planItemKey(item) {
  return cleanText(item?.text).toLocaleLowerCase("ru");
}

// Every distinct item used anywhere in the week, in week order: the adult's
// own "Ваши дела", added to another day with one tap. Days are visited in the
// given order; an item's picture is the first one found for it.
export function collectPlanItems(itemsByDay, dayOrder) {
  const seen = new Map();
  for (const day of dayOrder) {
    for (const item of itemsByDay[day] ?? []) {
      const key = planItemKey(item);
      if (!key) continue;
      const known = seen.get(key);
      if (!known) seen.set(key, { ...item });
      else if (!known.icon && item.icon) known.icon = item.icon;
    }
  }
  return [...seen.values()];
}

// The picture belongs to the item, not to one day: changing it for «Спорт»
// changes «Спорт» everywhere in the week.
export function setItemIconEverywhere(itemsByDay, key, icon) {
  return Object.fromEntries(
    Object.entries(itemsByDay).map(([day, items]) => [
      day,
      items.map((item) => (planItemKey(item) === key ? { ...item, icon: icon || null } : item)),
    ]),
  );
}

export function moveItem(items, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = items.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const PICTOGRAPH = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*/u;

// Whatever the adult typed or pasted (a system emoji keyboard, a copied
// emoji) -- the first picture in it, or null.
export function firstEmoji(text) {
  return PICTOGRAPH.exec(String(text ?? ""))?.[0] ?? null;
}

// Picture suggestions for a word as it is typed. Only a quick start: the
// adult chooses (owner, 2026-11-23) -- any emoji, a photo later, or none.
// Matched by the start of a word, so «бассейн», «Бассейна» and «в бассейн» all hit.
const SUGGESTIONS = [
  ["школ", ["🏫", "🎒"]],
  ["сад", ["🏫", "🧸"]],
  ["спорт", ["👟", "🏃", "🤸", "⚽"]],
  ["футбол", ["⚽"]],
  ["баскетбол", ["🏀"]],
  ["бассейн", ["🏊", "🩱"]],
  ["плав", ["🏊"]],
  ["гимнаст", ["🤸"]],
  ["занима", ["📚", "✏️", "📖"]],
  ["урок", ["📚", "✏️"]],
  ["чит", ["📖"]],
  ["пис", ["✏️"]],
  ["счет", ["🔢"]],
  ["счёт", ["🔢"]],
  ["логопед", ["🗣️", "👄"]],
  ["прогул", ["🚶", "🌳"]],
  ["гуля", ["🚶", "🌳"]],
  ["площадк", ["🛝"]],
  ["парк", ["🌳"]],
  ["кафе", ["☕", "🍰"]],
  ["ресторан", ["🍽️"]],
  ["магазин", ["🛒"]],
  ["покуп", ["🛒"]],
  ["врач", ["🩺", "🏥"]],
  ["доктор", ["🩺", "🏥"]],
  ["больниц", ["🏥"]],
  ["дом", ["🏠"]],
  ["дача", ["🏡"]],
  ["даче", ["🏡"]],
  ["мульт", ["📺", "📱"]],
  ["планшет", ["📱"]],
  ["телевиз", ["📺"]],
  ["игр", ["🧸", "🧩"]],
  ["спать", ["🛏️", "😴"]],
  ["сон", ["🛏️", "😴"]],
  ["ванн", ["🛁"]],
  ["душ", ["🚿"]],
  ["машин", ["🚗"]],
  ["поездк", ["🚗", "🚌", "🚆"]],
  ["автобус", ["🚌"]],
  ["поезд", ["🚆"]],
  ["самолет", ["✈️"]],
  ["самолёт", ["✈️"]],
  ["бабушк", ["👵"]],
  ["дедушк", ["👴"]],
  ["мам", ["👩"]],
  ["пап", ["👨"]],
  ["гост", ["🏠", "👨‍👩‍👧"]],
  ["музык", ["🎵", "🎹"]],
  ["рис", ["🖍️", "🎨"]],
  ["лепк", ["🧱"]],
  ["кино", ["🎬"]],
  ["театр", ["🎭"]],
  ["цирк", ["🎪"]],
  ["зоопарк", ["🦁"]],
  ["библиотек", ["📚"]],
  ["стрижк", ["💇"]],
  ["парикмах", ["💇"]],
  ["церк", ["⛪"]],
  ["праздник", ["🎉", "🎂"]],
  ["день рожд", ["🎂"]],
  ["обед", ["🍽️"]],
  ["завтрак", ["🥣"]],
  ["ужин", ["🍽️"]],
];

export function suggestEmoji(word) {
  const words = cleanText(word).toLocaleLowerCase("ru");
  if (words.length < 2) return [];
  const starts = words.split(" ");
  const found = [];
  for (const [stem, emojis] of SUGGESTIONS) {
    const hit = stem.includes(" ")
      ? words.includes(stem)
      : starts.some((w) => w.startsWith(stem) || (w.length >= 3 && stem.startsWith(w)));
    if (hit) for (const emoji of emojis) if (!found.includes(emoji)) found.push(emoji);
  }
  return found.slice(0, 6);
}

// The «Ещё картинки» grid: places, activities, transport, people, things.
export const FREQUENT_EMOJI = [
  "🏫", "🏠", "🏡", "🏥", "🛒", "☕", "🍽️", "🛝",
  "👟", "🏊", "⚽", "🏀", "🤸", "🚴", "⛸️", "🎿",
  "📚", "📖", "✏️", "🔢", "🧩", "🧸", "🎵", "🖍️",
  "🚶", "🌳", "🚗", "🚌", "🚆", "✈️", "🚲", "⛪",
  "👵", "👴", "👩", "👨", "👶", "🐶", "🎂", "🎉",
  "📺", "📱", "🛁", "🚿", "🛏️", "😴", "🩺", "💇",
];

// Monday first, like the week modal and the settings list.
export const PLAN_WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const PLAN_PREFIX = { 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб", 0: "Вс" };

export function parseWeekItems(weeklyPlan) {
  const byDay = parseWeeklyPlan(weeklyPlan);
  return Object.fromEntries(PLAN_WEEK_ORDER.map((day) => [day, parsePlanItems(byDay[day])]));
}

// Back to the stored «Пн: …» text; an empty day is left out.
export function serializeWeekItems(itemsByDay) {
  return PLAN_WEEK_ORDER
    .map((day) => {
      const line = serializePlanItems(itemsByDay[day]);
      return line ? `${PLAN_PREFIX[day]}: ${line}` : null;
    })
    .filter(Boolean)
    .join("\n");
}

// Photos of plan items live next to the plan, not in it (params.planPhotos,
// JSON of item key -> /api/photos/… URL): the «Пн: …» line stays readable
// for an older app, and the emoji stays as the picture wherever the photo
// can't be shown. Keyed like pictures, so «Спорт» has one photo in every day.
export function parsePlanPhotos(text) {
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, url]) => typeof url === "string" && url));
  } catch {
    return {};
  }
}

// Only items still in the week keep their photo; an empty map is "".
export function serializePlanPhotos(photos, itemsByDay) {
  const used = new Set(Object.values(itemsByDay).flat().map(planItemKey));
  const kept = Object.entries(photos ?? {}).filter(([key, url]) => used.has(key) && url);
  return kept.length ? JSON.stringify(Object.fromEntries(kept)) : "";
}

// ── «План на день» on the wall screen ─────────────────────────────────────
//
// The day's items: the weekly template for that weekday, the day's important
// dates and the adult's changes for that date (owner, 2026-11-23):
//   off   -- keys switched off for that date: a template item or an important
//            date stays in place crossed out («НЕ БУДЕТ») -- the child sees it
//            was cancelled, not that it vanished; an item added only for that
//            date is simply removed;
//   added -- items added only for that date.
// Every item sits in its part of the day (important dates «день» unless set).

export function eventPlanKey(event) {
  return `event:${event.id}`;
}

export function buildDayPlan({ templateItems = [], events = [], changes = {}, photos = {} }) {
  const off = new Set(changes.off ?? []);
  const base = templateItems.map((item) => ({
    key: planItemKey(item),
    text: item.text,
    icon: item.icon,
    daypart: item.daypart ?? "day",
    photo: photos[planItemKey(item)] ?? null,
  }));
  const extra = [
    ...events.map((event) => ({
      key: eventPlanKey(event),
      text: event.title,
      icon: event.icon ?? null,
      daypart: PLAN_DAYPARTS.includes(event.daypart) ? event.daypart : "day",
      photo: event.photo ?? null,
      important: true,
    })),
    ...(changes.added ?? [])
      .map((item) => ({
        key: planItemKey(item),
        text: item.text,
        icon: item.icon ?? null,
        daypart: PLAN_DAYPARTS.includes(item.daypart) ? item.daypart : "day",
        photo: photos[planItemKey(item)] ?? null,
        added: true,
      }))
      .filter((item) => !off.has(item.key)),
  ].filter((item) => !base.some((other) => other.key === item.key));
  return sortByDaypart([...base, ...extra]).map((item) => ({ ...item, cancelled: off.has(item.key) }));
}

export function toggleKey(list, key) {
  const set = new Set(list ?? []);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  return [...set];
}

// ── Changes shared between devices ───────────────────────────────────────
//
// Cancelled/added events for a date are made on the wall tablet or on a
// phone (owner, 2026-11-23), so they live in the account: one document per
// student, `daily_orientation:plan:<studentId>` -> { days: { "YYYY-MM-DD":
// { off, added, updatedAt } } }. Two devices merge it day by day, the newer
// day wins. «Сделали» marks are not in it: only the child makes them, at the
// wall, so they stay on that device and never overwrite a change from a phone.

export function planChangesKey(studentId) {
  return `daily_orientation:plan:${studentId}`;
}

export function normalizePlanDoc(value) {
  const days = value && typeof value === "object" && value.days && typeof value.days === "object" ? value.days : {};
  const clean = {};
  for (const [dateKey, day] of Object.entries(days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !day || typeof day !== "object") continue;
    clean[dateKey] = {
      off: Array.isArray(day.off) ? day.off.filter((key) => typeof key === "string") : [],
      added: Array.isArray(day.added) ? day.added.filter((item) => item && typeof item.text === "string") : [],
      updatedAt: Number(day.updatedAt) || 0,
    };
  }
  return { days: clean };
}

// Day by day, the newer one wins; days before oldestKey are dropped.
export function mergePlanDocs(a, b, oldestKey = "") {
  const left = normalizePlanDoc(a).days;
  const right = normalizePlanDoc(b).days;
  const days = {};
  for (const dateKey of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (dateKey < oldestKey) continue;
    const x = left[dateKey];
    const y = right[dateKey];
    days[dateKey] = !x ? y : !y ? x : (y.updatedAt > x.updatedAt ? y : x);
  }
  return { days };
}

export function updatePlanDoc(doc, dateKey, update, now = Date.now()) {
  const days = normalizePlanDoc(doc).days;
  const current = days[dateKey] ?? { off: [], added: [] };
  const next = update({ off: current.off, added: current.added });
  return { days: { ...days, [dateKey]: { off: next.off ?? [], added: next.added ?? [], updatedAt: now } } };
}
