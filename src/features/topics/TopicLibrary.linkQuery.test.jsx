import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { writeTopicUiPreview } from "@/core/topicUiPreview";
import TopicLibraryScreen from "./TopicLibraryScreen";

// TopicLinkScreen («Контрольная работа» of «Столбик» → «Контрольные по математике», not installed):
// the catalog opens searching that topic, among all topics, with its install button.
vi.mock("@/shared/components/TopicCover", () => ({ default: () => <span className="test-cover" /> }));
vi.mock("./catalogService", async (original) => ({ ...(await original()), fetchCatalog: vi.fn(async () => ({ decks: [
  { id: "column_addition", title: { ru: "Сложение и вычитание в столбик" }, version: "1.3.3", access: "paid", status: "beta" },
  { id: "math_tests", title: { ru: "Контрольные по математике" }, version: "0.2.0", access: "paid", status: "release" },
] })) }));

const scope = "account:link-query";
let root, host;
beforeEach(() => {
  writeTopicUiPreview(scope, false); // the legacy library opens on «Мои темы»
  useAppStore.setState({ screen: "topics", account: { id: "link-query" }, token: "test", activeStudentId: "student",
    students: [{ id: "student", name: "Ученик" }], activeTopicId: "column_addition", sessions: [], activeSessionSnapshot: null,
    topicRecords: [{ meta: { id: "column_addition", renderer: "column_addition", title: { ru: "Сложение и вычитание в столбик" }, version: "1.3.3" }, cards: [], modes: [] }],
    ownedTopics: [{ topicId: "column_addition", source: "paid" }], studentTopicLinks: {}, builtinVisibility: {}, archivedTopicIds: [],
    topicLibraryQuery: "Контрольные по математике" });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); useAppStore.setState({ account: null, token: null, topicLibraryQuery: "" }); });

it("opens on the linked topic, not installed yet, with an install button", async () => {
  await act(async () => root.render(<TopicLibraryScreen />));
  // the catalog arrives a moment later
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  expect(host.querySelector("input").value).toBe("Контрольные по математике");
  expect(host.textContent).toContain("Контрольные по математике");
  expect(host.textContent).not.toContain("Ничего не найдено");
  expect(useAppStore.getState().topicLibraryQuery).toBe(""); // taken once
});
