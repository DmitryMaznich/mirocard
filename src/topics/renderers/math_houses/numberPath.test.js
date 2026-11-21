import { describe, expect, it, vi } from "vitest";
import { readModeParams, writeModeParams } from "@/shared/utils/topicUtils.js";
import { generateTasks } from "./engine.js";
import { arePathNeighbors, generateNumberPath } from "./numberPath.js";
import { MATH_HOUSE_MODES, NUMBER_PATH_MODE, NUMBER_PATH_NUMBERS } from "./numberPathConfig.js";

const cards = NUMBER_PATH_NUMBERS.map((number) => ({
  id: `house_${number}`, conceptId: `house_${number}`, params: { number },
}));

describe("number composition routes", () => {
  it.each([[5, 5], [10, 10], [10, 14]])("uses side-connected routes with varying ends on %i × %i boards", (columns, size) => {
    const random = vi.spyOn(Math, "random");
    try {
      const ends = new Set();
      const firstMoves = new Set();
      for (const seed of [0, 0.13, 0.29, 0.51, 0.72, 0.99]) {
        random.mockReturnValue(seed);
        const tasks = generateTasks(NUMBER_PATH_MODE, [...cards].reverse(), 500, { boardSize: size });
        expect(tasks.map(({ number }) => number)).toEqual(NUMBER_PATH_NUMBERS);
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

  it("builds a new lap in the same order from the saved round", () => {
    const first = generateNumberPath(cards, { boardSize: 5 });
    const second = generateNumberPath(cards, { boardSize: 5 }, first);
    expect(generateNumberPath(cards, { boardSize: 5 }, first)).toEqual(second);
    expect(second.map((task) => task.number)).toEqual(NUMBER_PATH_NUMBERS);
    expect(second.every((task, index) => task.layoutIndex !== first[index].layoutIndex)).toBe(true);
    const prior = first.at(-1).route;
    expect([second[0].route[0], second[0].route.at(-1)]).not.toEqual([prior[0], prior.at(-1)]);
  });

  it("repeats correct pairs even on the smallest board for 5", () => {
    const { cells, route } = generateTasks(NUMBER_PATH_MODE, cards, 500, { boardSize: 5 }).find((task) => task.number === 5);
    const pairs = route.slice(1, -1).map((i) => cells[i].join(" + "));
    expect(new Set(pairs).size).toBe(4);
    expect(pairs.length).toBeGreaterThan(4);
  });

  it("starts with 2 on a small board when mode settings are missing", () => {
    const [task] = generateTasks(NUMBER_PATH_MODE, cards);
    expect(task).toMatchObject({ number: 2, size: 5, cardId: "house_2" });
  });

  it.each([3, 4])("opens a 5 × 5 board for the old saved %i setting", (boardSize) => {
    const [task] = generateTasks(NUMBER_PATH_MODE, cards, 500, { boardSize });
    expect(task.size).toBe(5);
  });

  it("opens a rectangular board for the old saved 15 × 15 setting", () => {
    const [task] = generateTasks(NUMBER_PATH_MODE, cards, 500, { boardSize: 15 });
    expect(task).toMatchObject({ columns: 10, size: 14 });
    expect(task.cells).toHaveLength(140);
  });

  it("keeps the path settings when a number house is used", () => {
    const [house] = MATH_HOUSE_MODES;
    const pathParams = { boardSize: 14, mistakeBehavior: "restart" };
    const saved = writeModeParams({ subtype: "read" }, NUMBER_PATH_MODE, pathParams);
    const updated = writeModeParams(saved, house, { subtype: "recall" });
    expect(readModeParams(updated, NUMBER_PATH_MODE)).toEqual(pathParams);
    expect(readModeParams(updated, house).subtype).toBe("recall");
  });
});
