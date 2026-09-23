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
      "showAnalogClock",
      "showTimeWords",
      "showDigitalTime",
    ]);
    expect(Object.values(mode.params).every((param) => param.type === "boolean" && param.default === true)).toBe(true);
  });
});
