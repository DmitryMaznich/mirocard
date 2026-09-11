import { describe, expect, it } from "vitest";
import { mergeMyPeople } from "./bootstrap";

describe("mergeMyPeople", () => {
  it("combines separate additions from two devices", () => {
    const merged = mergeMyPeople(
      [{ id: "anna", name: "Анна", updatedAt: "2026-09-09T10:00:00.000Z" }],
      [{ id: "pavel", name: "Павел", updatedAt: "2026-09-09T10:01:00.000Z" }],
    );
    expect(merged.map((person) => person.id).sort()).toEqual(["anna", "pavel"]);
  });

  it("preserves the server photo URL on an equal-timestamp sync tie", () => {
    const timestamp = "2026-09-09T10:00:00.000Z";
    const [merged] = mergeMyPeople(
      [{ id: "anna", updatedAt: timestamp, photos: ["/api/photos/resolved"] }],
      [{ id: "anna", updatedAt: timestamp, photos: ["data:image/jpeg;base64,local"] }],
    );
    expect(merged.photos).toEqual(["/api/photos/resolved"]);
  });

  it("keeps a newly introduced axis from the fresher person record", () => {
    const [merged] = mergeMyPeople(
      [{ id: "anna", introducedAxes: ["name"], updatedAt: "2026-09-09T10:00:00.000Z" }],
      [{ id: "anna", introducedAxes: ["name", "relation"], updatedAt: "2026-09-09T10:01:00.000Z" }],
    );
    expect(merged.introducedAxes).toEqual(["name", "relation"]);
  });
});
