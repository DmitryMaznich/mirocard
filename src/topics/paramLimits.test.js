import { describe, expect, it } from "vitest";
import { allowedEnumValues, applyParamLimits } from "./paramLimits";

const modeParams = {
  maxNumber: { type: "enum", values: [5, 10, 20], default: 10 },
  changeMax: { type: "enum", values: [1, 3, 5, 10, 99], default: 3, limitBy: "maxNumber", anyValue: 99 },
};

describe("changeMax limited by maxNumber", () => {
  it("offers only changes up to the maximum, «любое» only for the widest range", () => {
    expect(allowedEnumValues(modeParams.changeMax, { maxNumber: 5 }, modeParams)).toEqual([1, 3, 5]);
    expect(allowedEnumValues(modeParams.changeMax, { maxNumber: 10 }, modeParams)).toEqual([1, 3, 5, 10]);
    expect(allowedEnumValues(modeParams.changeMax, { maxNumber: 20 }, modeParams)).toEqual([1, 3, 5, 10, 99]);
  });

  it("turns a value that no longer fits into the largest allowed one", () => {
    expect(applyParamLimits(modeParams, { maxNumber: 5, changeMax: 10 })).toEqual({ maxNumber: 5, changeMax: 5 });
    expect(applyParamLimits(modeParams, { maxNumber: 5, changeMax: 99 })).toEqual({ maxNumber: 5, changeMax: 5 });
    expect(applyParamLimits(modeParams, { maxNumber: 10, changeMax: 99 })).toEqual({ maxNumber: 10, changeMax: 10 });
  });

  it("leaves fitting settings untouched (same object)", () => {
    const params = { maxNumber: 20, changeMax: 99 };
    expect(applyParamLimits(modeParams, params)).toBe(params);
  });
});
