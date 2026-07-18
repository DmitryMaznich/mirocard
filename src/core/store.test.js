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

  it("has null sessionIngredientOverrides", () => {
    expect(getStore().sessionIngredientOverrides).toBeNull();
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

  it("setSessionIngredientOverrides updates the value", () => {
    getStore().setSessionIngredientOverrides({ oil: 2.5 });
    expect(getStore().sessionIngredientOverrides).toEqual({ oil: 2.5 });
  });

  it("setActiveInstructionId updates selection", () => {
    getStore().setActiveInstructionId("kitchen_cleaning");
    expect(getStore().activeInstructionId).toBe("kitchen_cleaning");
  });

  it("setInstructionConstructorId updates selection", () => {
    getStore().setInstructionConstructorId("abc-123");
    expect(getStore().instructionConstructorId).toBe("abc-123");
  });

  it("setSyncStatus updates sync status", () => {
    getStore().setSyncStatus("syncing");
    expect(getStore().syncStatus).toBe("syncing");
  });
});
