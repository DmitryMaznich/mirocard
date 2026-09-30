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
    const done = [...container.querySelectorAll(".mp-editor__actions button")].find((button) => button.textContent === "Готово");
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

  it("stops adding and switching on people at 20 active cards", async () => {
    const crowd = Array.from({ length: 20 }, (_, index) => ({ ...anna, id: `p${index}`, name: `Имя ${index}` }));
    const spare = { ...anna, id: "spare", name: "Запасной", enabled: false };
    useAppStore.setState({ students: [{ id: "student_1", name: "Миша", myPeople: [...crowd, spare], myPeopleProfile: {} }] });
    await mount();

    expect(container.querySelector(".mp-add-compact").disabled).toBe(true);
    expect(container.querySelector(".mp-limit-hint").textContent).toMatch(/Не больше 20/);
    const spareSwitch = [...container.querySelectorAll(".mp-person-card")]
      .find((card) => card.textContent.includes("Запасной"))
      .querySelector(".mp-switch input");
    expect(spareSwitch.disabled).toBe(true);
  });

  it("hides the add-photo button at five photos", async () => {
    useAppStore.setState({ students: [{ id: "student_1", name: "Миша", myPeople: [{ ...anna, photos: ["a", "b", "c", "d", "e"].map((h) => `/api/photos/${h}`) }], myPeopleProfile: {} }] });
    await mount();
    await click(container.querySelector(".mp-person-card__main"));

    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    expect(container.querySelector(".mp-editor__photo-copy button")).toBeNull();
    expect(container.textContent).toMatch(/5 фото · это максимум/);
  });

  it("removes a photo only on the second tap", async () => {
    useAppStore.setState({ students: [{ id: "student_1", name: "Миша", myPeople: [{ ...anna, photos: ["/api/photos/a", "/api/photos/b"] }], myPeopleProfile: {} }] });
    await mount();
    await click(container.querySelector(".mp-person-card__main"));
    const remove = () => container.querySelectorAll(".mp-editor__thumb-remove")[1];

    await click(remove());
    expect(sync.pushOp).not.toHaveBeenCalled();
    expect(remove().textContent).toBe("Удалить?");

    await click(remove());
    expect(pushedPeople()[0].photos).toEqual(["/api/photos/a"]);
  });

  it("asks before deleting a card", async () => {
    await mount();
    await click(container.querySelector(".mp-person-card__main"));
    const button = (name) => [...container.querySelectorAll("button")].find((b) => b.textContent === name);

    await click(button("Удалить карточку"));
    expect(sync.pushOp).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Удалить карточку «Анна» вместе с фото\?/);

    await click(button("Отмена"));
    expect(button("Удалить карточку")).toBeTruthy();

    await click(button("Удалить карточку"));
    await click(button("Удалить"));
    expect(pushedPeople()[0]).toEqual(expect.objectContaining({ id: "anna", photos: [], deletedAt: expect.any(String) }));
  });

  it("goes back to where it was opened from", async () => {
    useAppStore.setState({ myPeopleReturnScreen: "modes" });
    await mount();
    await click(container.querySelector(".back-btn"));
    expect(useAppStore.getState().screen).toBe("modes");
    expect(useAppStore.getState().myPeopleReturnScreen).toBeNull();
  });

  it("goes back to the student card by default", async () => {
    useAppStore.setState({ myPeopleReturnScreen: null });
    await mount();
    await click(container.querySelector(".back-btn"));
    expect(useAppStore.getState().screen).toBe("student_edit");
  });
});
