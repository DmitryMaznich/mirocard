import { describe, expect, it } from "vitest";
import {
  nameActionCorrectAudioItems,
  observeStartAudioItems,
} from "./audioPhrases";

describe("addition/subtraction phrase audio", () => {
  it("uses the Kore word bank after the starting-quantity phrase", () => {
    expect(observeStartAudioItems(45)).toEqual([
      { url: "/audio/addition-subtraction/phrases/was.mp3", tight: false },
      { url: "/audio/addition-subtraction/n40.mp3", tight: false },
      { url: "/audio/addition-subtraction/n5.mp3", tight: true },
    ]);
  });

  it("composes the count-step confirmation without baking numbers into a phrase file", () => {
    expect(nameActionCorrectAudioItems({ operation: "add", countStep: true, delta: 2, start: 3, result: 5 })).toEqual([
      { url: "/audio/addition-subtraction/phrases/correct_added_count.mp3", tight: false },
      { url: "/audio/addition-subtraction/n2.mp3", tight: false },
      { url: "/audio/addition-subtraction/phrases/was.mp3", tight: false },
      { url: "/audio/addition-subtraction/n3.mp3", tight: false },
      { url: "/audio/addition-subtraction/phrases/became.mp3", tight: false },
      { url: "/audio/addition-subtraction/n5.mp3", tight: false },
    ]);
  });
});
