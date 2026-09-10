import { describe, expect, it } from "vitest";
import { isCorrectAssociation } from "./matching";

describe("people album matching", () => {
  it("accepts the matching person for a name", () => {
    expect(isCorrectAssociation("name", { personId: "anna", label: "Анна" }, { personId: "anna", label: "Анна" })).toBe(true);
    expect(isCorrectAssociation("name", { personId: "pavel", label: "Павел" }, { personId: "anna", label: "Анна" })).toBe(false);
  });

  it("accepts either identical relationship label without making two teachers an impossible task", () => {
    expect(isCorrectAssociation("relation", { personId: "teacher_1", label: "учитель" }, { personId: "teacher_2", label: "учитель" })).toBe(true);
  });
});
