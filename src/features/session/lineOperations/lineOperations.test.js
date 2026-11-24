import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import catalog from "../../../../public/decks/catalog.json";
import app from "../../../../package.json";
import { openDb } from "@/core/db";
import { importTopic } from "@/topics/topicLoader";
import { handleAdvance, handleAnswer, handleStreakReset } from "../sessionEngine";
import { buildGeneratedSessionState, resolveModeSelection } from "../useSessionEngine";
import { evaluateLineOperationStroke, generateLineOperationTasks, lineExamplePoints, LINE_OPERATIONS_MODE } from "./model";

const topicId = "symmetry_draw";
const card = { id: "line_operations_board", conceptId: "line_operations_board" };

describe("line operations", () => {
  it.each(["plus", "minus", "mixed"])("generates playable cards for %s", (selection) => {
    const tasks = generateLineOperationTasks(selection, card);
    expect(tasks).toHaveLength(16);
    if (selection === "mixed") {
      expect(tasks.filter(({ operation }) => operation === "plus")).toHaveLength(8);
      expect(tasks.filter(({ operation }) => operation === "minus")).toHaveLength(8);
      expect(tasks.some((task, index) => task.operation === tasks[index + 1]?.operation)).toBe(true);
    } else {
      expect(tasks.every(({ operation }) => operation === selection)).toBe(true);
    }
    for (const task of tasks) {
      expect(task.target.length).toBeGreaterThan(0);
      const target = new Set(task.target);
      for (const edge of task.target) {
        const nodes = edge.split("-");
        expect(evaluateLineOperationStroke(lineExamplePoints(nodes.reverse()), target)).toEqual({ kind: "correct", edges: [edge] });
      }
    }
  });

  it("combines all the segments from the two drawings", () => {
    const [task, withSharedStroke] = generateLineOperationTasks("plus", card);
    expect(task.target).toHaveLength(8);
    const count = [...withSharedStroke.first, ...withSharedStroke.second]
      .reduce((sum, path) => sum + path.length - 1, 0);
    expect(withSharedStroke.target).toHaveLength(count - 1);
  });

  it("accepts connected and individual lines, preserving the position of the result", () => {
    const [task] = generateLineOperationTasks("minus", card);
    const target = new Set(task.target);
    expect(evaluateLineOperationStroke(lineExamplePoints(["30", "21", "11", "00"]), target)).toEqual({
      kind: "correct", edges: ["21-30", "11-21", "00-11"],
    });
    expect(evaluateLineOperationStroke(lineExamplePoints(["11", "10"]), target).kind).toBe("incorrect");
    expect(evaluateLineOperationStroke(lineExamplePoints(["11", "12"]), target).kind).toBe("incorrect");
    expect(evaluateLineOperationStroke([[17, 17], [19, 18]], target).kind).toBe("idle");
    expect(evaluateLineOperationStroke([[17, 17], [45, 16], [39, 39]], target).kind).toBe("incorrect");
  });

  it("starts from the current deck using saved mode settings and the regular video reward", async () => {
    const entry = catalog.decks.find(({ id }) => id === topicId);
    const bytes = Uint8Array.from(await readFile("public/decks/" + entry.zipUrl));
    const db = await openDb("line-operations-" + crypto.randomUUID());
    await expect(importTopic(db, bytes, "1.1.202")).rejects.toThrow("1.1.203");
    const topicRecord = await importTopic(db, bytes, app.version);
    const mode = topicRecord.modes.find(({ id }) => id === LINE_OPERATIONS_MODE);
    expect(mode).toMatchObject({ hideConceptPicker: true, evaluation: "auto", loop: true });
    expect(Object.keys(mode.params)).toEqual(["lineAction"]);
    const link = { params: { byMode: { [mode.id]: { lineAction: "mixed" } } }, selectedConceptIds: ["yachta"], answersPerStar: 3 };
    const settings = resolveModeSelection(topicRecord, mode, link, false, null);
    let state = buildGeneratedSessionState({
      ...settings, topicRecord, mode, activeTopicId: topicId, activeStudentId: "student", link,
    });
    expect(state.tasks.slice(0, 2).map(({ operation }) => operation)).toEqual(["plus", "minus"]);
    state = handleStreakReset(state, card.conceptId, card.id);
    expect(state.taskIndex).toBe(0);
    state = handleAdvance(handleAnswer(state, true));
    expect(state.streakCount).toBe(0);
    for (let i = 1; i <= 15; i += 1) {
      state = handleAdvance(handleAnswer(state, true));
      expect(state.rewardEarnedCount).toBe(i === 15 ? 1 : 0);
    }
  });
});
