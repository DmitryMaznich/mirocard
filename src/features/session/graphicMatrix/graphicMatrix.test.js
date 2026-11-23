import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { openDb } from "@/core/db";
import { getTopicRecord, importTopic } from "@/topics/topicLoader";
import { buildGeneratedSessionState, resolveModeSelection } from "../useSessionEngine";
import { handleAdvance, handleAnswer, handleStreakReset } from "../sessionEngine";
import { evaluateMatrixStroke, matrixCellTargets, sampleLines } from "./model";

const storageTopic = "symmetry_draw";
const matrixMode = "graphic_matrix";
const zipPath = "public/decks/symmetry_draw_v1.13.0.zip";

async function install() {
  const db = await openDb("graphic-matrix-" + crypto.randomUUID());
  const bytes = await readFile(zipPath);
  const deck = Uint8Array.from(bytes);
  await expect(importTopic(db, deck, "1.1.191")).rejects.toThrow("1.1.192");
  expect(await getTopicRecord(db, storageTopic)).toBeFalsy();
  return importTopic(db, deck, "1.1.192");
}

function sessionFor(topicRecord, boardSize, answersPerStar = 1) {
  const mode = topicRecord.modes.find(({ id }) => id === matrixMode);
  const link = {
    params: { byMode: { [matrixMode]: { boardSize } } },
    selectedConceptIds: ["yachta"],
    answersPerStar,
  };
  const selected = resolveModeSelection(topicRecord, mode, link, false, null);
  return buildGeneratedSessionState({
    topicRecord, mode, activeTopicId: storageTopic, activeStudentId: "student", link, ...selected,
  });
}

describe("graphic matrix", () => {
  it("installs through the deck loader, scopes the parameter and starts with both approved layouts", async () => {
    const topic = await install();
    const mode = topic.modes.find(({ id }) => id === matrixMode);
    expect(mode).toMatchObject({ hideConceptPicker: true, evaluation: "auto", loop: true });
    expect(Object.keys(mode.params)).toEqual(["boardSize"]);
    const practice = sessionFor(topic, "2x2");
    const independent = sessionFor(topic, "4x4");
    expect(practice.tasks[0].rows).toEqual([["horizontal", 1], ["horizontal", 2]]);
    expect(independent.tasks[0].columns).toEqual([["falling", 1], ["vertical", 2], ["vertical", 4], ["vertical", 1]]);
    expect(independent.tasks[0].rows).toEqual([["horizontal", 2], ["horizontal", 1], ["horizontal", 3], ["rising", 1]]);
    expect(new Set(independent.tasks.map(({ rows, columns }) => JSON.stringify([rows, columns]))).size).toBe(16);
    for (const task of [...practice.tasks, ...independent.tasks]) {
      const targets = matrixCellTargets(task.rows, task.columns);
      for (const target of targets) {
        const accepted = [];
        for (const points of [task.rows[target.row], task.columns[target.column]].flatMap(sampleLines)) {
          const result = evaluateMatrixStroke([...points].reverse(), target, accepted);
          expect(result.kind).toBe("correct");
          accepted.push(result.stroke);
        }
        expect(accepted).toHaveLength(target.total);
      }
    }
  });

  it("changes both heading groups between consecutive boards and across the loop", async () => {
    const topic = await install();
    for (const size of ["2x2", "4x4"]) {
      const { tasks } = sessionFor(topic, size);
      const sides = ["rows", "columns"];
      const shapes = new Set();
      tasks.forEach((task, index) => {
        const following = tasks[(index + 1) % tasks.length];
        for (const side of sides) {
          expect(task[side]).not.toEqual(following[side]);
          if (size === "4x4") {
            const group = (board) => board[side].map((sample) => sample.join(":")).sort();
            expect(group(task)).not.toEqual(group(following));
          }
          task[side].forEach((sample) => shapes.add(sample.join(":")));
        }
      });
      if (size === "2x2") {
        expect(shapes.size).toBe(4);
      } else {
        for (const direction of ["rising", "falling"]) {
          expect(shapes.has(direction + ":2")).toBe(true);
          expect(shapes.has(direction + ":3")).toBe(true);
        }
        for (const corner of ["topLeft", "topRight", "bottomLeft", "bottomRight"]) {
          expect(shapes.has(corner + ":1")).toBe(true);
        }
      }
    }
  });

  it("accepts one rounded corner in either drawing direction and rejects the opposite corner and double bends", () => {
    const target = { counts: { topLeft: 1, falling: 1 } };
    const rounded = [[74, 20], [51, 18], [30, 20], [22, 24], [18, 31], [19, 51], [18, 76]];
    expect(evaluateMatrixStroke(rounded, target, []).stroke?.orientation).toBe("topLeft");
    expect(evaluateMatrixStroke([...rounded].reverse(), target, []).stroke?.orientation).toBe("topLeft");
    expect(evaluateMatrixStroke(sampleLines(["bottomRight", 1])[0], target, []).kind).toBe("direction");
    expect(evaluateMatrixStroke([[76, 18], [18, 18], [18, 54], [52, 54]], target, []).kind).toBe("shape");
    expect(evaluateMatrixStroke([[76, 18], [18, 18]], target, []).kind).toBe("direction");
    expect(evaluateMatrixStroke([[18, 18], [76, 76]], target, []).stroke?.orientation).toBe("falling");
  });

  it("treats touches and short movement as idle and catches material stroke errors", () => {
    const target = { counts: { horizontal: 2, falling: 1 } };
    const stroke = (points, accepted = []) => evaluateMatrixStroke(points, target, accepted);
    const accepted = stroke([[15, 45], [45, 49], [85, 46]]).stroke;
    expect(accepted.orientation).toBe("horizontal");
    expect(stroke([[10, 10], [18, 11]]).kind).toBe("idle");
    expect(stroke([[10, 10], [27, 11]]).kind).toBe("idle");
    expect(stroke([[50, 40], [92, 40], [109, 40]]).kind).toBe("outside");
    expect(stroke([[15, 45], [40, 78], [70, 45]]).kind).toBe("shape");
    expect(stroke([[45, 15], [45, 85]]).kind).toBe("direction");
    expect(stroke([[15, 46], [85, 46]], [accepted]).kind).toBe("duplicate");
    const second = stroke([[18, 65], [82, 64]], [accepted]).stroke;
    expect(stroke([[12, 80], [85, 80]], [accepted, second]).kind).toBe("extra");
  });

  it.each([1, 2, 3])("credits complete fields at 5 × %i and blocks credit after in-place corrections", async (answersPerStar) => {
    const topic = await install();
    let state = sessionFor(topic, "2x2", answersPerStar);
    expect(state.answersPerStar).toBe(answersPerStar);
    const { taskIndex, taskRetry } = state;
    state = handleStreakReset(state, "graphic_matrix_board", "graphic_matrix_board");
    expect(state).toMatchObject({ status: "task_active", taskIndex, incorrectCount: 1 });
    expect(state.taskRetry).toBe(taskRetry);
    state = handleAdvance(handleAnswer(state, true));
    expect(state.streakCount).toBe(0);
    for (let i = 1; i <= 5 * answersPerStar; i += 1) {
      state = handleAdvance(handleAnswer(state, true));
      expect(state.rewardEarnedCount).toBe(i === 5 * answersPerStar ? 1 : 0);
    }
    expect(state.status).toBe("task_active");
  });
});
