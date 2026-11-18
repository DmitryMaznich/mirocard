import { describe, expect, it } from "vitest";
import { createSessionState, handleAdvance } from "./sessionEngine.js";

const tasks = [{ type: "t" }, { type: "t" }];
const at = (mode, index) => ({ ...createSessionState(tasks, mode, "s", "topic", "1", []), taskIndex: index, status: "task_active" });

describe("leaving the last task by an answer with help or «дальше»", () => {
  it("an instant-scored mode goes round", () => {
    const next = handleAdvance(at({ id: "m", evaluation: "instant" }, 1));
    expect(next.status).toBe("task_active");
    expect(next.taskIndex).toBe(0);
  });
  it("a finite instant mode (a check) still ends", () => {
    expect(handleAdvance(at({ id: "m", evaluation: "instant", finite: true }, 1)).status).toBe("completed");
  });
  it("a mode scored by the adult still ends", () => {
    expect(handleAdvance(at({ id: "m", evaluation: "manual" }, 1)).status).toBe("completed");
  });
});
