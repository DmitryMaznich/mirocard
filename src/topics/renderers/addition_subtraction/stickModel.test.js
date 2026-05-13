import { describe, expect, it } from "vitest";
import {
  buildStickSlots,
  evaluateStickMove,
  getStickBeadColor,
  getStickBeadCount,
  getStickSideCount,
  getStickSlotIndexAtClientX,
  isStickComplete,
} from "./stickModel";

const addTask = {
  operation: "add",
  start: 2,
  delta: 3,
  result: 5,
  railSize: 10,
};

const subtractTask = {
  operation: "subtract",
  start: 9,
  delta: 4,
  result: 5,
  railSize: 10,
};

function slot(slots, zone, zoneIndex) {
  return slots.find((item) => item.zone === zone && item.zoneIndex === zoneIndex);
}

describe("addition/subtraction stick model", () => {
  it("always renders a full 10-bead stick plus the separator gap", () => {
    const slots = buildStickSlots(addTask, 2);

    expect(getStickBeadCount(addTask)).toBe(10);
    expect(slots).toHaveLength(12);
    expect(slots.filter((item) => item.occupied)).toHaveLength(10);
    expect(slots.filter((item) => item.zone === "work")).toHaveLength(2);
    expect(slots.filter((item) => item.zone === "gap")).toHaveLength(2);
    expect(slots.filter((item) => item.zone === "side")).toHaveLength(8);
    expect(getStickSideCount(addTask, 2)).toBe(8);
  });

  it("colors 10-bead sticks green and 20-bead sticks as ten green plus ten orange", () => {
    const task20 = { ...addTask, railSize: 20, start: 12, result: 15 };
    const colors = buildStickSlots(task20, 12)
      .filter((item) => item.occupied)
      .map((item) => getStickBeadColor(task20, item.beadIndex));

    expect(buildStickSlots(addTask, 2).filter((item) => item.occupied).every((item) => getStickBeadColor(addTask, item.beadIndex) === "green")).toBe(true);
    expect(colors.filter((color) => color === "green")).toHaveLength(10);
    expect(colors.filter((color) => color === "orange")).toHaveLength(10);
  });

  it("moves one or several beads from the side into the working group for addition", () => {
    const slots = buildStickSlots(addTask, 2);
    const one = evaluateStickMove(addTask, 2, slot(slots, "side", 0), -60);
    const three = evaluateStickMove(addTask, 2, slot(slots, "side", 2), -120);

    expect(one).toEqual({ kind: "move", nextWorkCount: 3, movedCount: 1, complete: false });
    expect(three).toEqual({ kind: "move", nextWorkCount: 5, movedCount: 3, complete: true });
    expect(isStickComplete(addTask, three.nextWorkCount)).toBe(true);
  });

  it("supports partial subtraction and then finishing 9 - 4", () => {
    const startSlots = buildStickSlots(subtractTask, 9);
    const firstMove = evaluateStickMove(subtractTask, 9, slot(startSlots, "work", 7), 90);

    expect(firstMove).toEqual({ kind: "move", nextWorkCount: 7, movedCount: 2, complete: false });
    expect(getStickSideCount(subtractTask, firstMove.nextWorkCount)).toBe(3);

    const nextSlots = buildStickSlots(subtractTask, firstMove.nextWorkCount);
    const secondMove = evaluateStickMove(subtractTask, 7, slot(nextSlots, "work", 5), 90);

    expect(secondMove).toEqual({ kind: "move", nextWorkCount: 5, movedCount: 2, complete: true });
  });

  it("recognizes the direct correct movement for 9 - 4", () => {
    const slots = buildStickSlots(subtractTask, 9);
    const result = evaluateStickMove(subtractTask, 9, slot(slots, "work", 5), 140);

    expect(result).toEqual({ kind: "move", nextWorkCount: 5, movedCount: 4, complete: true });
  });

  it("rejects the wrong direction no matter how many beads would move", () => {
    const addSlots = buildStickSlots(addTask, 2);
    const subtractSlots = buildStickSlots(subtractTask, 9);

    expect(evaluateStickMove(addTask, 2, slot(addSlots, "side", 0), 60).kind).toBe("mistake");
    expect(evaluateStickMove(addTask, 2, slot(addSlots, "side", 5), 60).kind).toBe("mistake");
    expect(evaluateStickMove(subtractTask, 9, slot(subtractSlots, "work", 8), -60).kind).toBe("mistake");
    expect(evaluateStickMove(subtractTask, 9, slot(subtractSlots, "work", 5), -60).kind).toBe("mistake");
  });

  it("rejects moving too many beads in the correct direction", () => {
    const addSlots = buildStickSlots(addTask, 2);
    const subtractSlots = buildStickSlots(subtractTask, 9);

    expect(evaluateStickMove(addTask, 2, slot(addSlots, "side", 3), -90).kind).toBe("mistake");
    expect(evaluateStickMove(subtractTask, 9, slot(subtractSlots, "work", 4), 90).kind).toBe("mistake");
  });

  it("does not turn a short tap into an answer", () => {
    const slots = buildStickSlots(addTask, 2);

    expect(evaluateStickMove(addTask, 2, slot(slots, "side", 0), 2).kind).toBe("noop");
  });

  it("maps pointer coordinates to fixed slot indexes", () => {
    const rect = { left: 10, width: 120 };

    expect(getStickSlotIndexAtClientX(10, rect, 12)).toBe(0);
    expect(getStickSlotIndexAtClientX(79, rect, 12)).toBe(6);
    expect(getStickSlotIndexAtClientX(999, rect, 12)).toBe(11);
  });
});
