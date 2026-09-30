import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import MyPeopleSettingsScreen from "./MyPeopleSettingsScreen";

const database = vi.hoisted(() => ({
  getDb: vi.fn(() => Promise.resolve({})),
  kv: { set: vi.fn(() => Promise.resolve()) },
}));
const sync = vi.hoisted(() => ({ pushOp: vi.fn(() => Promise.resolve()) }));

const network = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("@/core/db", () => database);
vi.mock("@/core/syncApi", () => sync);
vi.mock("@/core/api", () => ({ api: { post: network.post }, getApiToken: () => "tok" }));
vi.mock("@/shared/utils/squarePhoto", () => ({
  PHOTO_ACCEPT: "image/*",
  PhotoPrepareError: class extends Error {},
  squarePhotoDataUrl: vi.fn(() => Promise.resolve("data:image/jpeg;base64,NEW")),
}));

let root = null;
let container = null;

const anna = {
  id: "anna", type: "person", name: "Анна", relation: "мама", contexts: ["family"],
  photos: ["/api/photos/abc"], introducedAxes: [], enabled: true,
  createdAt: "2026-09-10T09:00:00.000Z", updatedAt: "2026-09-10T09:00:00.000Z", deletedAt: null,
};

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<MyPeopleSettingsScreen />); });
}

async function click(element) {
  await act(async () => { element.click(); });
  await act(async () => { await Promise.resolve(); });
}

function pushedPeople() {
  const call = sync.pushOp.mock.calls.findLast(([type]) => type === "student.my_people.upsert");
  return call?.[1].people;
}

describe("MyPeopleSettingsScreen persistence", () => {
  beforeEach(() => {
    database.kv.set.mockClear();
    sync.pushOp.mockClear();
    network.post.mockReset();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    useAppStore.setState({
      screen: "my_people_settings",
      editingStudentId: "student_1",
      students: [{ id: "student_1", name: "Миша", myPeople: [anna], myPeopleProfile: {} }],
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    vi.unstubAllGlobals();
  });

  it("saves an edited card as soon as the editor is closed with Готово", async () => {
    await mount();
    await click(container.querySelector(".mp-person-card__main"));

    const relation = container.querySelector('input[placeholder="Например, мама"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(relation, "бабушка");
      relation.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const done = [...container.querySelectorAll("button")].find((button) => button.textContent === "Готово");
    await click(done);

    expect(pushedPeople()).toEqual([expect.objectContaining({ id: "anna", relation: "бабушка" })]);
    expect(useAppStore.getState().students[0].myPeople[0].relation).toBe("бабушка");
    expect(database.kv.set).toHaveBeenCalled();
    expect(useAppStore.getState().screen).toBe("my_people_settings");
  });

  it("saves a toggled card immediately", async () => {
    await mount();
    await click(container.querySelector(".mp-person-card .mp-switch input"));

    expect(pushedPeople()).toEqual([expect.objectContaining({ id: "anna", enabled: false })]);
  });

  it("does not send anything when an untouched card is closed", async () => {
    await mount();
    await click(container.querySelector(".mp-person-card__main"));
    await click(container.querySelector('[aria-label="Закрыть"]'));

    expect(sync.pushOp).not.toHaveBeenCalled();
  });

  async function pickPhoto() {
    await click(container.querySelector(".mp-person-card__main"));
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { value: [new File(["x"], "p.jpg", { type: "image/jpeg" })], configurable: true });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => { await Promise.resolve(); });
  }

  it("uploads a new photo on its own and keeps only the short reference on the card", async () => {
    network.post.mockResolvedValue({ url: "/api/photos/new" });
    await mount();
    await pickPhoto();

    expect(network.post).toHaveBeenCalledWith("/photos", { dataUrl: "data:image/jpeg;base64,NEW" });
    expect(pushedPeople()[0].photos).toEqual(["/api/photos/abc", "/api/photos/new"]);
  });

  it("keeps the photo locally when the upload fails, so the regular sync carries it", async () => {
    network.post.mockRejectedValue(new TypeError("Failed to fetch"));
    await mount();
    await pickPhoto();

    expect(pushedPeople()[0].photos).toEqual(["/api/photos/abc", "data:image/jpeg;base64,NEW"]);
  });
});
