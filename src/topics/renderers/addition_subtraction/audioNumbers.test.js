import { describe, it, expect } from "vitest";
import { numberToAudioKeys, numberToWords, taskAudioKeys } from "./audioNumbers";

describe("numberToAudioKeys", () => {
  it("says 0-20 as a single recorded word", () => {
    expect(numberToAudioKeys(0)).toEqual(["n0"]);
    expect(numberToAudioKeys(7)).toEqual(["n7"]);
    expect(numberToAudioKeys(11)).toEqual(["n11"]);
    expect(numberToAudioKeys(20)).toEqual(["n20"]);
  });

  it("composes 21-99 from a tens word and a ones word", () => {
    expect(numberToAudioKeys(21)).toEqual(["n20", "n1"]);
    expect(numberToAudioKeys(45)).toEqual(["n40", "n5"]);
    expect(numberToAudioKeys(99)).toEqual(["n90", "n9"]);
  });

  it("says a round ten/hundred as a single word, with no trailing zero", () => {
    expect(numberToAudioKeys(30)).toEqual(["n30"]);
    expect(numberToAudioKeys(100)).toEqual(["n100"]);
  });

  it("reads naturally as words", () => {
    expect(numberToWords(21)).toBe("двадцать один");
    expect(numberToWords(7)).toBe("семь");
    expect(numberToWords(100)).toBe("сто");
  });
});

describe("taskAudioKeys", () => {
  it("orders start, sign, delta", () => {
    const keys = taskAudioKeys({ start: 2, operation: "add", delta: 11 });
    expect(keys).toEqual(["n2", "plus", "n11"]);
  });

  it("uses the minus word for subtraction", () => {
    const keys = taskAudioKeys({ start: 45, operation: "subtract", delta: 20 });
    expect(keys).toEqual(["n40", "n5", "minus", "n20"]);
  });
});
