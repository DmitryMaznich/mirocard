import { describe, it, expect } from "vitest";
import { planLesson, toolForStep } from "./lessonPlan.js";

const pencils = {
  black: { id: "black", color: "#000000" },
  base: { id: "base", color: "#abcdef" },
  pattern: { id: "pattern", color: "#123456" },
};
const source = {
  id: "test", palette: ["black", "base", "pattern"], steps: [
    { title: "collar", kind: "color", tool: "pattern", fill: "#123456" },
    { title: "outline", kind: "stroke", tool: "black" },
    { title: "shirt base", kind: "color", tool: "base", fill: "#abcdef" },
    { title: "diamonds", kind: "color", tool: "pattern", fill: "#123456" },
    { title: "other base", kind: "color", tool: "base", fill: "#abcdef" },
  ],
};
describe("drawing pencil plan", () => {
  it("finishes each pencil once, with base coats before patterns and stable order inside a colour", () => {
    const result = planLesson(source, pencils);
    expect(result.steps.map(step => step.title)).toEqual(["outline", "shirt base", "other base", "collar", "diamonds"]);
    expect(source.steps[0].title).toBe("collar");
  });
  it("reports the required pencil and progress before animation, also when going back across a colour boundary", () => {
    const lesson = planLesson(source, pencils);
    expect(toolForStep(lesson, 3)).toMatchObject({ tool: { id: "pattern" }, first: 3, position: 1, total: 2 });
    expect(toolForStep(lesson, 2)).toMatchObject({ tool: { id: "base" }, first: 1, position: 2, total: 2 });
    expect(toolForStep(lesson, 5)).toBeNull();
  });
  it("rejects an unknown or missing pencil and a fill that disagrees with the instruction", () => {
    expect(() => planLesson({ ...source, palette: ["black", "missing"] }, pencils)).toThrow("Unknown pencil");
    expect(() => planLesson({ ...source, steps: [{ title: "bad", kind: "color", tool: "base", fill: "#eeeeee" }] }, pencils)).toThrow("disagree");
  });
});
