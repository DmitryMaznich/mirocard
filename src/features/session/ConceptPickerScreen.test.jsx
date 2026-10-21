import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ConceptPickerScreen from "./ConceptPickerScreen";
import { useAppStore } from "@/core/store";

const mocks = vi.hoisted(() => ({ persist: vi.fn() }));
vi.mock("@/core/linkUtils", () => ({ persistStudentTopicLink: mocks.persist }));
let root, host;
const initial = useAppStore.getState();
const card = (conceptId, group) => ({ id: conceptId, conceptId, label: conceptId, primary: true, group });
const topic = {
  meta: { id: "verbs", title: { ru: "Глаголы" }, renderer: "flashcards", groups: { set1: { ru: "Набор 1" }, set2: { ru: "Набор 2" } } },
  cards: [card("eats", "set1"), card("drinks", "set1"), card("sits", "set2"), card("gives", "set2")],
  modes: [{ id: "intro", type: "intro" }],
};
const button = (text) => [...host.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
const confirmButton = () => [...host.querySelectorAll("button")].find((b) => b.textContent.startsWith("Подтвердить"));
async function open(selectedConceptIds) {
  useAppStore.setState({ activeStudentId: "kid", activeTopicId: "verbs", activeModeId: "intro", topicRecords: [topic], sessions: [],
    studentTopicLinks: { kid_verbs: { selectedConceptIds } }, screen: "concepts" });
  await act(async () => root.render(<ConceptPickerScreen />));
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); useAppStore.setState(initial, true); });

it("opens with the saved selection: verbs switched off stay off", async () => {
  await open(["eats", "sits"]);
  expect(confirmButton().textContent).toBe("Подтвердить (2)");
  await act(async () => confirmButton().click());
  expect(mocks.persist).toHaveBeenCalledWith("kid", "verbs", expect.objectContaining({ selectedConceptIds: ["eats", "sits"] }));
});

it("«Выбрать только» keeps exactly the chosen set", async () => {
  await open(["eats", "drinks", "sits", "gives"]);
  expect(button("Выбрать только: Набор 2")).toBeUndefined();
  await act(async () => button("Набор 2").click());
  await act(async () => button("Выбрать только: Набор 2").click());
  await act(async () => confirmButton().click());
  expect(mocks.persist.mock.calls[0][2].selectedConceptIds.sort()).toEqual(["gives", "sits"]);
});
