import { describe, expect, it, vi } from "vitest";
import { readModeParams, writeModeParams } from "@/shared/utils/topicUtils.js";
import { createSessionState, handleAdvance, handleAnswer, handleInPlaceIncorrect } from "@/features/session/sessionEngine.js";
import { generateTasks } from "./engine.js";
import { arePathNeighbors, generateNumberPath } from "./numberPath.js";
import { MATH_HOUSE_MODES, normalizeNumberPathParams, NUMBER_PATH_MODE, NUMBER_PATH_NUMBERS } from "./numberPathConfig.js";

const cards = NUMBER_PATH_NUMBERS.map((number) => ({
  id: `house_${number}`, conceptId: `house_${number}`, params: { number },
}));
const defaultPathNumbers = NUMBER_PATH_NUMBERS.filter((number) => number >= 3);

describe("number composition routes", () => {
  it.each([[5, 5], [10, 10], [10, 14]])("uses side-connected routes with varying ends on %i × %i boards", (columns, size) => {
    const random = vi.spyOn(Math, "random");
    try {
      const ends = new Set();
      const firstMoves = new Set();
      for (const seed of [0, 0.13, 0.29, 0.51, 0.72, 0.99]) {
        random.mockReturnValue(seed);
        const minNumber = size === 5 ? 3 : 6;
        const tasks = generateTasks(NUMBER_PATH_MODE, [...cards].reverse(), 500, { boardSize: size, minNumber, maxNumber: 10 });
        expect(tasks.map(({ number }) => number)).toEqual(defaultPathNumbers.filter((number) => number >= minNumber));
        tasks.forEach(({ cells, route, number, cardId }, index) => {
          expect(cardId).toBe(`house_${number}`);
          expect(cells).toHaveLength(columns * size);
          const [start, finish] = [route[0], route.at(-1)];
          const prior = tasks[index - 1]?.route;
          if (prior) expect([start, finish]).not.toEqual([prior[0], prior.at(-1)]);
          ends.add(`${start}:${finish}`);
          firstMoves.add(route[1] - start);
          expect(cells[start]).toEqual([number, 0]);
          expect(cells[finish]).toEqual([0, number]);
          expect(cells.filter(([a, b]) => a + b === number && (a === 0 || b === 0))).toHaveLength(2);
          const passable = cells.flatMap(([a, b], i) => a + b === number ? [i] : []);
          expect([...route].sort((a, b) => a - b)).toEqual(passable);
          route.forEach((cell, step) => {
            const expected = [route[step - 1], route[step + 1]].filter((i) => i !== undefined);
            const neighbors = passable.filter((i) => arePathNeighbors(i, cell, columns));
            expect(neighbors).toEqual(expected.sort((a, b) => a - b));
          });
          if (size > 5) expect(route.length).toBeGreaterThan(2 * size);
        });
      }
      expect(ends.size).toBeGreaterThan(4);
      expect(firstMoves).toEqual(new Set([-1, 1, -columns, columns]));
    } finally {
      random.mockRestore();
    }
  });

  it.each([10, 14])("starts on the selected large board and keeps it on a new lap (%i)", (boardSize) => {
    const params = { minNumber: 4, maxNumber: 7, boardSize };
    const first = generateNumberPath(cards, params);
    const second = generateNumberPath(cards, params, first);
    expect(generateNumberPath(cards, params, first)).toEqual(second);
    expect(first.map(({ number, size }) => [number, size])).toEqual([[6, boardSize], [7, boardSize]]);
    expect(second.map(({ number, size }) => [number, size])).toEqual([[6, boardSize], [7, boardSize]]);
    expect(second.every((task, index) => task.layoutIndex !== first[index].layoutIndex)).toBe(true);
  });

  it("defaults to 19 and loops a legacy single-number setting above the new limit", () => {
    const tasks = generateTasks(NUMBER_PATH_MODE, cards, { minNumber: 11 });
    expect(tasks.map((task) => task.number)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19]);
    const params = { minNumber: 20, maxNumber: 20, boardSize: 14 };
    const [first] = generateNumberPath(cards, params);
    const [second] = generateNumberPath(cards, params, [first]);
    expect(second).toMatchObject({ number: 19, cardId: "number_path_19", columns: 10, size: 14 });
    expect(second.route).not.toEqual(first.route);
    for (const [index, [a, b]] of second.cells.entries()) {
      expect(a + b <= 19).toBe(true);
      expect(a + b === 19).toBe(second.route.includes(index));
    }
  });

  it("normalizes invalid or inverted saved limits and caps the small range", () => {
    expect(normalizeNumberPathParams({ minNumber: -1, maxNumber: 40 })).toEqual({ minNumber: 3, maxNumber: 19, boardSize: 5 });
    expect(normalizeNumberPathParams({ minNumber: "9", maxNumber: "5", boardSize: 15 })).toEqual({ minNumber: 5, maxNumber: 5, boardSize: 5 });
  });

  it.each([[5, 0], [10, 1], [14, 1]])("credits %i boards with the correct prize count after one clean route", (boardSize, expected) => {
    const tasks = generateNumberPath(cards, { boardSize });
    const [first, second] = tasks;
    const state = createSessionState(tasks, NUMBER_PATH_MODE, "kid", "math_houses", "1", [], null, false, 3, true, { version: 2, lossMode: "one" });
    expect(handleAnswer(handleInPlaceIncorrect(state), true).rewardEarnedCount).toBe(0);
    const finished = handleAnswer(state, true, first.conceptId, first.cardId);
    expect(finished).toMatchObject({ correctCount: 1, rewardEarnedCount: expected, status: "answer_correct" });
    expect(handleAnswer(finished, true).rewardEarnedCount).toBe(expected);
    if (expected) expect(handleAnswer({ ...state, streakCount: 4 }, true).rewardEarnedCount).toBe(1);
    const next = handleAdvance(finished);
    expect(next.rewardEarnedCount).toBe(expected);
    expect(handleAnswer(next, true, second.conceptId, second.cardId).rewardEarnedCount).toBe(2 * expected);
  });

  it("repeats correct pairs even on the smallest board for 5", () => {
    const { cells, route } = generateTasks(NUMBER_PATH_MODE, cards, 500, { boardSize: 5 }).find((task) => task.number === 5);
    const pairs = route.slice(1, -1).map((i) => cells[i].join(" + "));
    expect(new Set(pairs).size).toBe(4);
    expect(pairs.length).toBeGreaterThan(4);
  });

  it("starts with 3 on a small board when mode settings are missing", () => {
    const [task] = generateTasks(NUMBER_PATH_MODE, cards);
    expect(task).toMatchObject({ number: 3, size: 5, cardId: "house_3" });
  });

  it.each([3, 4])("opens a 5 × 5 board for the old saved %i setting", (boardSize) => {
    const [task] = generateTasks(NUMBER_PATH_MODE, cards, 500, { boardSize });
    expect(task.size).toBe(5);
  });

  it("opens a rectangular board for the old saved 15 × 15 setting", () => {
    const [task] = generateTasks(NUMBER_PATH_MODE, cards, 500, { boardSize: 15 });
    expect(task).toMatchObject({ number: 6, columns: 10, size: 14 });
    expect(task.cells).toHaveLength(140);
  });

  it("keeps the path settings when a number house is used", () => {
    const [house] = MATH_HOUSE_MODES;
    const pathParams = { minNumber: 5, maxNumber: 12, boardSize: 14, mistakeBehavior: "restart" };
    const saved = writeModeParams({ subtype: "read" }, NUMBER_PATH_MODE, pathParams);
    const updated = writeModeParams(saved, house, { subtype: "recall" });
    expect(readModeParams(updated, NUMBER_PATH_MODE)).toEqual(pathParams);
    expect(readModeParams(updated, house).subtype).toBe("recall");
  });
});
