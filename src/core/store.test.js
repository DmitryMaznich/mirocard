import { describe, it, expect } from "vitest";
import { useAppStore } from "./store";

const getStore = () => useAppStore.getState();

describe("initial state", () => {
  it("has correct initial screen", () => {
    expect(getStore().screen).toBe("boot");
  });

  it("has empty students array", () => {
    expect(getStore().students).toEqual([]);
  });

  it("has null account", () => {
    expect(getStore().account).toBeNull();
  });
});

describe("actions", () => {
  it("setScreen updates screen", () => {
    getStore().setScreen("home");
    expect(getStore().screen).toBe("home");
  });

  it("setStudents replaces students array", () => {
    getStore().setStudents([{ id: "s1", name: "Маша" }]);
    expect(getStore().students).toHaveLength(1);
  });

  it("setAccount updates account", () => {
    getStore().setAccount({ id: "a1", email: "test@test.com" });
    expect(getStore().account.email).toBe("test@test.com");
  });

  it("setActiveStudentId updates selection", () => {
    getStore().setActiveStudentId("s1");
    expect(getStore().activeStudentId).toBe("s1");
  });

  it("setSyncStatus updates sync status", () => {
    getStore().setSyncStatus("syncing");
    expect(getStore().syncStatus).toBe("syncing");
  });
});
