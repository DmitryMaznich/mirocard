import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUDIO_ENTRIES,
  WEATHER_WORDS,
  dateClipKeys,
  monthClipKeys,
  seasonClipKeys,
  timeClipKeys,
  weatherClipKeys,
  weekdayClipKeys,
} from "./audioBank.js";

const BANK_KEYS = new Set(AUDIO_ENTRIES.map((entry) => entry.key));

function everyDayOfLeapYear() {
  return Array.from({ length: 366 }, (_, index) => new Date(2028, 0, 1 + index, 12));
}

describe("daily orientation clip bank", () => {
  it("has unique keys", () => {
    expect(BANK_KEYS.size).toBe(AUDIO_ENTRIES.length);
  });

  it("covers every sentence any card can ask for, for every day, offset and minute", () => {
    const requested = new Set();
    for (const date of everyDayOfLeapYear()) {
      for (const offset of [-1, 0, 1]) {
        [weekdayClipKeys, dateClipKeys, monthClipKeys, seasonClipKeys]
          .forEach((build) => build(date, offset).forEach((key) => requested.add(key)));
      }
    }
    for (let minutes = 0; minutes < 24 * 60; minutes++) {
      timeClipKeys(new Date(2028, 0, 1, Math.floor(minutes / 60), minutes % 60)).forEach((key) => requested.add(key));
    }
    Object.keys(WEATHER_WORDS).forEach((id) => weatherClipKeys(id).forEach((key) => requested.add(key)));

    expect([...requested].filter((key) => !BANK_KEYS.has(key))).toEqual([]);
    expect([...BANK_KEYS].filter((key) => !requested.has(key))).toEqual([]);
  });

  it("picks the past-tense lead that agrees with the value", () => {
    expect(weekdayClipKeys(new Date(2026, 8, 27), -1)).toEqual(["lead_yesterday_n", "weekday_0"]); // воскресенье
    expect(weekdayClipKeys(new Date(2026, 8, 23), -1)).toEqual(["lead_yesterday_f", "weekday_3"]); // среда
    expect(weekdayClipKeys(new Date(2026, 8, 22), -1)).toEqual(["lead_yesterday_m", "weekday_2"]); // вторник
    expect(seasonClipKeys(new Date(2026, 6, 1), -1)).toEqual(["lead_yesterday_n", "season_summer"]);
    expect(dateClipKeys(new Date(2026, 8, 26), 1)).toEqual(["lead_tomorrow", "ordinal_26", "month_gen_9"]);
    expect(timeClipKeys(new Date(2026, 8, 25, 10, 0))).toEqual(["lead_now", "hour_10", "min_00"]);
  });

  it("has a recorded file for every clip", () => {
    const dir = join(process.cwd(), "public", "audio", "daily-orientation");
    expect(AUDIO_ENTRIES.filter((entry) => !existsSync(join(dir, `${entry.key}.mp3`))).map((entry) => entry.key)).toEqual([]);
  });
});
