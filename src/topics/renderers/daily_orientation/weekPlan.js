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

export function parsePlanItems(dayText) {
  if (!dayText) return [];
  return String(dayText)
    .split(ITEM_SEPARATOR)
    .map((part) => {
      const { icon, text } = splitPlanIcon(part.trim());
      return { icon: icon ?? null, text: cleanText(text) };
    })
    .filter((item) => item.text || item.icon);
}

export function serializePlanItems(items) {
  return (items ?? [])
    .map((item) => ({ icon: item.icon || null, text: cleanText(item.text) }))
    .filter((item) => item.text || item.icon)
    .map((item) => (item.icon ? `${item.icon} ${item.text}`.trim() : item.text))
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
