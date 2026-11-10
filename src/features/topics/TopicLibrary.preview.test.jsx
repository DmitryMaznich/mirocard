import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { writeTopicUiPreview } from "@/core/topicUiPreview";
import TopicLibraryScreen from "./TopicLibraryScreen";

vi.mock("@/shared/components/TopicCover", () => ({ default: () => <span className="test-cover" /> }));
vi.mock("./catalogService", async (original) => ({ ...(await original()), fetchCatalog: vi.fn(async () => ({ decks: [
  { id: "ordinary", title: "Обычная тема", version: "1", access: "free" },
  { id: "reading", title: "Чтение", version: "1", access: "free" },
] })) }));
vi.mock("./topicLanguageChoice", async (original) => ({ ...(await original()), requestTopicLanguage: vi.fn(async () => false) }));

describe("preview library preserves selection and visibility rules", () => {
  let root, host;
  const scope = "account:preview-library";
  const topic = (id, renderer = "comparison", extra = {}) => ({ meta: { id, renderer, title: id, version: "1", ...extra }, cards: [], modes: [{ id: "first" }, { id: "second" }] });
  beforeEach(() => {
    writeTopicUiPreview(scope, false);
    useAppStore.setState({ screen: "home", account: { id: "preview-library" }, token: "test", activeStudentId: "student",
      students: [{ id: "student", name: "Ученик" }], activeTopicId: null, activeModeId: null,
      sessions: [], activeSessionSnapshot: null, topicRecords: [topic("ordinary"), topic("reading", "reading")],
      ownedTopics: [{ topicId: "ordinary", source: "free" }, { topicId: "reading", source: "free" }],
      studentTopicLinks: {}, builtinVisibility: {}, archivedTopicIds: [],
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); writeTopicUiPreview(scope, false); useAppStore.setState({ account: null, token: null }); });
  async function mount(props) { await act(async () => root.render(<TopicLibraryScreen {...props} />)); }

  it("keeps the legacy topic selection returning to Home by default", async () => {
    await mount();
    expect(host.querySelector(".topic-ui-installed-grid")).toBeNull();
    await act(async () => host.querySelector(".topic-tile-row").click());
    expect(useAppStore.getState().screen).toBe("home");
  });

  it("opens reading through its text picker and ordinary themes through their modes", async () => {
    writeTopicUiPreview(scope, true);
    await mount({ embedded: true });
    await act(async () => host.querySelector('[data-topic-id="reading"] .topic-ui-topic-open').click());
    expect(useAppStore.getState().screen).toBe("texts");
    await act(async () => host.querySelector('[data-topic-id="ordinary"] .topic-ui-topic-open').click());
    expect(useAppStore.getState().screen).toBe("modes");
    expect(useAppStore.getState().activeTopicId).toBe("ordinary");
  });

  it("does not expose unowned or hidden themes and keeps alphabetical order", async () => {
    writeTopicUiPreview(scope, true);
    useAppStore.setState({ topicRecords: [topic("ordinary"), topic("reading", "reading"), topic("private-other-account"), topic("hidden", "comparison", { hidden: true })],
      sessions: [{ studentId: "other", topicId: "reading", completedAt: "2026-11-09T00:00:00Z" },
        { studentId: "student", topicId: "ordinary", completedAt: "2026-11-01T00:00:00Z" }] });
    await mount({ embedded: true });
    expect(host.querySelector('[data-topic-id="private-other-account"]')).toBeNull();
    expect(host.querySelector('[data-topic-id="hidden"]')).toBeNull();
    // The latest topic is in the «Продолжить» card above; the grid does not
    // mark or move it — a topic keeps its alphabetical place.
    expect(host.querySelector(".topic-ui-tile--recent")).toBeNull();
    const order = [...host.querySelectorAll(".topic-ui-installed-grid article")].map((tile) => tile.dataset.topicId);
    expect(order).toEqual([...order].sort((x, y) => host.querySelector(`[data-topic-id="${x}"] strong`).textContent
      .localeCompare(host.querySelector(`[data-topic-id="${y}"] strong`).textContent, "ru")));
    expect(host.querySelector(".topic-ui-add-tile")).not.toBeNull();
  });

  it("lists only topics not added yet in the catalog, the rest one tap away", async () => {
    writeTopicUiPreview(scope, true);
    useAppStore.setState({ topicRecords: [topic("ordinary")], ownedTopics: [{ topicId: "ordinary", source: "free" }] });
    await mount();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const listed = () => [...host.querySelectorAll(".topic-ui-catalog-list article")].map((row) => row.dataset.topicId);
    expect(listed()).toContain("reading");
    expect(listed()).not.toContain("ordinary");
    await act(async () => host.querySelector(".topic-ui-show-installed").click());
    expect(listed()).toContain("ordinary");
  });

  it("does not navigate into a language package that was not installed", async () => {
    writeTopicUiPreview(scope, true);
    const record = topic("ordinary");
    record.languageContract = { defaultLanguage: "ru", packages: { ru: { modeIds: ["first"] } } };
    useAppStore.setState({ topicRecords: [record] });
    await mount({ embedded: true });
    await act(async () => host.querySelector('[data-topic-id="ordinary"] .topic-ui-topic-open').click());
    expect(useAppStore.getState().screen).toBe("home");
    expect(useAppStore.getState().activeTopicId).toBeNull();
  });
});
