import { test } from "node:test";
import assert from "node:assert/strict";
import { commandsToPath } from "./verify_trace.mjs";

test("commandsToPath walks straight moves", () => {
  const points = commandsToPath({ col: 1, row: 1 }, [
    { direction: "right", cells: 3 },
    { direction: "down", cells: 2 },
  ]);
  assert.deepEqual(points, [
    { col: 1, row: 1 },
    { col: 4, row: 1 },
    { col: 4, row: 3 },
  ]);
});

test("commandsToPath walks diagonal moves and can return to start", () => {
  const points = commandsToPath({ col: 5, row: 5 }, [
    { direction: "up_left", cells: 2 },
    { direction: "down_right", cells: 2 },
  ]);
  assert.deepEqual(points, [
    { col: 5, row: 5 },
    { col: 3, row: 3 },
    { col: 5, row: 5 },
  ]);
});

test("commandsToPath throws on an unknown direction", () => {
  assert.throws(
    () => commandsToPath({ col: 0, row: 0 }, [{ direction: "diagonal", cells: 1 }]),
    /Unknown direction: diagonal/
  );
});
