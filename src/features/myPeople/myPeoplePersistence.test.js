import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { markPersonAxisIntroduced } from "./myPeoplePersistence";

const database = vi.hoisted(() => ({
  getDb: vi.fn(() => Promise.resolve({})),
  kv: { set: vi.fn(() => Promise.resolve()) },
}));
const sync = vi.hoisted(() => ({ pushOp: vi.fn(() => Promise.resolve()) }));

vi.mock("@/core/db", () => database);
vi.mock("@/core/syncApi", () => sync);

describe("markPersonAxisIntroduced", () => {
  beforeEach(() => {
    database.getDb.mockClear();
    database.kv.set.mockClear();
    sync.pushOp.mockClear();
    useAppStore.setState({
      students: [{
        id: "student_1",
        myPeople: [{ id: "anna", introducedAxes: ["name"], updatedAt: "2026-09-10T09:00:00.000Z" }],
      }],
    });
  });

  it("stamps the person and sends the existing myPeople upsert", async () => {
    await expect(markPersonAxisIntroduced("student_1", "anna", "relation")).resolves.toBe(true);

    const [student] = useAppStore.getState().students;
    expect(student.myPeople[0]).toEqual(expect.objectContaining({
      introducedAxes: ["name", "relation"],
      updatedAt: expect.any(String),
    }));
    expect(student.myPeopleUpdatedAt).toBe(student.myPeople[0].updatedAt);
    expect(database.kv.set).toHaveBeenCalledWith({}, "students", [student]);
    expect(sync.pushOp).toHaveBeenCalledWith("student.my_people.upsert", {
      studentId: "student_1",
      people: student.myPeople,
      updatedAt: student.myPeopleUpdatedAt,
    });
  });
});
