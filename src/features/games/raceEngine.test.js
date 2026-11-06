import { describe, expect, it } from "vitest";
import { FINISH, comparisonAnswer, createRace, raceReducer } from "./raceEngine";

function play(state, child, adult) {
  let race = raceReducer(state, { type: "dice", player: 0, value: child });
  race = raceReducer(race, { type: "dice", player: 1, value: adult });
  race = raceReducer(race, { type: "compare", answer: comparisonAnswer(race.dice) });
  while (race.phase === "moving") race = raceReducer(race, { type: "tick" });
  return race;
}

describe("physical dice race", () => {
  it("cannot finish before both players have thrown at least three times", () => {
    let race = createRace();
    for (let i = 0; i < 3; i++) race = play(race, 6, 6);
    expect(race.positions).toEqual([18,18]);
    expect(race.result).toBeNull();
    expect(play(race, 1, 1).result).toBe("tie");
  });
  it("requires two physical results and the correct comparison before moving", () => {
    let race = createRace();
    expect(raceReducer(race, { type: "compare", answer: "equal" })).toBe(race);
    race = raceReducer(race, { type: "dice", player: 0, value: 5 });
    race = raceReducer(race, { type: "dice", player: 1, value: 3 });
    race = raceReducer(race, { type: "compare", answer: "adult" });
    expect(race.mistake).toBe(true);
    expect(race.positions).toEqual([0,0]);
    expect(race.phase).toBe("input");
    race = raceReducer(race, { type: "compare", answer: "child" });
    expect(race.phase).toBe("moving");
    expect(raceReducer(race, { type:"compare", answer:"child" })).toBe(race);
    expect(raceReducer(race, { type:"dice", player:0, value:6 })).toBe(race);
    expect(play(createRace(),5,3).positions).toEqual([5,3]);
  });
  it("clears wrong answer feedback when an entered result changes", () => {
    let race = { ...createRace(), dice:[6,2], answer:"adult", mistake:true };
    race = raceReducer(race, { type: "dice", player: 0, value: 1 });
    expect(race.answer).toBeNull();
    expect(race.mistake).toBe(false);
    expect(race.phase).toBe("input");
    expect(raceReducer(race, { type:"dice", player:0, value:7 })).toBe(race);
  });
  it("handles equality without awarding an advantage", () => {
    expect(comparisonAnswer([4,4])).toBe("equal");
    expect(play(createRace(),4,4).positions).toEqual([4,4]);
  });
  it("waits for both cars before resolving a shared finishing round", () => {
    let race = { ...createRace(), positions:[18,14], dice:[1,6] };
    race = raceReducer(race, { type:"compare", answer:"adult" });
    race = raceReducer(race, { type:"tick" });
    expect(race.positions).toEqual([FINISH,15]);
    expect(race.result).toBeNull();
    while (race.phase === "moving") race = raceReducer(race, { type:"tick" });
    expect(race.result).toBe("tie");
    expect(race.positions).toEqual([FINISH,FINISH]);
  });
  it("resolves either winner, allows overshooting, and blocks duplicate moves", () => {
    const nearFinish = { ...createRace(), positions:[16,10] };
    const win = play(nearFinish,6,6);
    expect(win.result).toBe("child");
    expect(win.positions).toEqual([FINISH,16]);
    expect(play({ ...createRace(), positions:[10,16] },6,6).result).toBe("adult");
    expect(raceReducer(win, { type:"compare", answer:"child" })).toBe(win);
    expect(raceReducer(win, { type:"tick" })).toBe(win);
  });
});
