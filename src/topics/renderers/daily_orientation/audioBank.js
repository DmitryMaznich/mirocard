import {
  DATE_ORDINALS,
  HOUR_WORDS,
  MINUTE_WORDS,
  MONTHS_GENITIVE,
  MONTHS_NOMINATIVE,
  SEASON_PAST_VERB,
  SEASON_WORDS,
  WEEKDAY_NAMES,
  WEEKDAY_PAST_VERB,
  getSeason,
  russianPlural,
} from "./timeUtils.js";

// Recorded Gemini/Kore clips for this topic's spoken cards. Every sentence is
// assembled at playback time from a shared "lead" clip ("Вчера было",
// "Завтра будет", "Сейчас"...) plus one or two value clips ("воскресенье",
// "двадцать шестое" + "сентября"), so the whole screen needs ~160 files
// instead of one per possible sentence.
//
// `tone` tells the generator how to read a clip: "lead" = unfinished
// intonation (the sentence goes on after it), "final" = the sentence ends
// here. Values that sit mid-sentence (a date's ordinal, the hour half of a
// time) are also "lead".

export const AUDIO_BASE_URL = "/audio/daily-orientation";

export const DAYPART_WORDS = {
  morning: "утро",
  day: "день",
  evening: "вечер",
  night: "ночь",
};

export const WEATHER_WORDS = {
  sunny: "солнечная",
  cloudy: "пасмурная",
  rain: "дождливая",
  snow: "снежная",
  fog: "туманная",
};

const PAST_VERB_KEY = { был: "lead_yesterday_m", была: "lead_yesterday_f", было: "lead_yesterday_n" };

const LEADS = [
  { key: "lead_today", text: "Сегодня" },
  { key: "lead_now", text: "Сейчас" },
  { key: "lead_yesterday_m", text: "Вчера был" },
  { key: "lead_yesterday_f", text: "Вчера была" },
  { key: "lead_yesterday_n", text: "Вчера было" },
  { key: "lead_tomorrow", text: "Завтра будет" },
  { key: "lead_weather", text: "Погода" },
].map((entry) => ({ ...entry, tone: "lead" }));

function hourKey(hours) { return `hour_${String(hours).padStart(2, "0")}`; }
function minuteKey(minutes) { return `min_${String(minutes).padStart(2, "0")}`; }

export const AUDIO_ENTRIES = [
  ...LEADS,
  ...WEEKDAY_NAMES.map((text, day) => ({ key: `weekday_${day}`, text, tone: "final" })),
  ...MONTHS_NOMINATIVE.map((text, index) => ({ key: `month_${index + 1}`, text, tone: "final" })),
  ...MONTHS_GENITIVE.map((text, index) => ({ key: `month_gen_${index + 1}`, text, tone: "final" })),
  ...DATE_ORDINALS.map((text, index) => ({ key: `ordinal_${index + 1}`, text, tone: "lead" })),
  ...Object.entries(SEASON_WORDS).map(([id, text]) => ({ key: `season_${id}`, text, tone: "final" })),
  ...Object.entries(WEATHER_WORDS).map(([id, text]) => ({ key: `weather_${id}`, text, tone: "final" })),
  ...Object.entries(DAYPART_WORDS).map(([id, text]) => ({ key: `daypart_${id}`, text, tone: "final" })),
  ...HOUR_WORDS.map((word, hours) => ({
    key: hourKey(hours),
    text: `${word} ${russianPlural(hours, "час", "часа", "часов")}`,
    tone: "lead",
  })),
  { key: minuteKey(0), text: "ровно", tone: "final" },
  ...MINUTE_WORDS.slice(1).map((word, index) => {
    const minutes = index + 1;
    return { key: minuteKey(minutes), text: `${word} ${russianPlural(minutes, "минута", "минуты", "минут")}`, tone: "final" };
  }),
];

function relativeLead(offset, pastVerb) {
  if (offset < 0) return PAST_VERB_KEY[pastVerb];
  if (offset > 0) return "lead_tomorrow";
  return null;
}

export function weekdayClipKeys(date, offset) {
  const day = date.getDay();
  return [relativeLead(offset, WEEKDAY_PAST_VERB[day]) ?? "lead_today", `weekday_${day}`];
}

export function dateClipKeys(date, offset) {
  return [
    relativeLead(offset, "было") ?? "lead_today",
    `ordinal_${date.getDate()}`,
    `month_gen_${date.getMonth() + 1}`,
  ];
}

// Month names are all masculine, hence the fixed "был".
export function monthClipKeys(date, offset) {
  return [relativeLead(offset, "был") ?? "lead_now", `month_${date.getMonth() + 1}`];
}

export function seasonClipKeys(date, offset) {
  const { id } = getSeason(date.getMonth());
  return [relativeLead(offset, SEASON_PAST_VERB[id]) ?? "lead_now", `season_${id}`];
}

export function weatherClipKeys(weatherId) {
  return ["lead_weather", `weather_${weatherId}`];
}

export function daypartClipKeys(daypartId) {
  return ["lead_now", `daypart_${daypartId}`];
}

export function timeClipKeys(date) {
  return ["lead_now", hourKey(date.getHours()), minuteKey(date.getMinutes())];
}

export function clipUrl(key) {
  return `${AUDIO_BASE_URL}/${key}.mp3`;
}
