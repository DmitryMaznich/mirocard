import { describe, expect, it } from "vitest";
import { buildDailyOrientationTopicRecord } from "./builtinDailyOrientationTopic.js";

describe("daily orientation built-in mode", () => {
  it("uses display switches instead of concepts or a video reward", () => {
    const topic = buildDailyOrientationTopicRecord();
    const mode = topic.modes[0];

    expect(mode.hideConceptPicker).toBe(true);
    expect(mode.hideVideoReward).toBe(true);
    expect(Object.keys(mode.params)).toEqual([
      "showCarousel",
      "showWeekday",
      "showDayOfMonth",
      "showMonth",
      "showSeason",
      "showDaypart",
      "showWeather",
      "showAnalogClock",
      "showTimeWords",
      "showDigitalTime",
      "wakeHour",
      "bedHour",
      "letterCase",
      "timeWordsStyle",
      "cardSound",
      "importantDatesStyle",
      "weeklyPlan",
    ]);
    const switches = Object.entries(mode.params).filter(([key]) => key.startsWith("show")).map(([, param]) => param);
    expect(switches.every((param) => param.type === "boolean" && param.default === true)).toBe(true);
    expect(mode.params.cardSound).toMatchObject({ type: "boolean", default: false });
    expect(mode.params.importantDatesStyle).toMatchObject({ type: "enum", default: "bright", values: ["bright", "calm", "off"] });
  });
});
