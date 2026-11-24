import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlanTodayEditor from "./PlanTodayEditor.jsx";
import DailyOrientationRenderer from "@/topics/renderers/daily_orientation/index.jsx";
import { useAppStore } from "@/core/store";

// A phone and the wall tablet share one account document; this fake account
// stands in for the server between them.
function fakeAccount() {
  const store = new Map();
  return {
    store,
    kv: {
      list: vi.fn(async (prefix) => [...store].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, value }))),
      put: vi.fn(async (key, value) => { store.set(key, JSON.parse(JSON.stringify(value))); }),
    },
  };
}

describe("PlanTodayEditor — a change from the phone reaches the wall", () => {
  let roots = [];
  afterEach(() => {
    for (const { root, el } of roots) { act(() => root.unmount()); el.remove(); }
    roots = [];
    vi.useRealTimers();
    window.localStorage.clear();
  });

  async function mount(node) {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => root.render(node));
    roots.push({ root, el });
    return el;
  }

  it("switches today's school off on the phone; the wall shows it crossed out after its next check", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date(2026, 9, 7, 8, 0)); // a Wednesday
    const params = { weeklyPlan: "Ср: 🏫 Школа [утро], 📚 Занимаемся [вечер], 🛏️ Спать [ночь]" };
    const student = { id: "s1", importantDates: [] };
    const account = fakeAccount();

    const phone = await mount(<PlanTodayEditor params={params} student={student} kv={account.kv} />);
    const school = Array.from(phone.querySelectorAll(".dos-today__item")).find((b) => b.textContent.includes("Школа"));
    await act(async () => school.click());
    expect(school.getAttribute("aria-pressed")).toBe("true");
    expect(account.store.get("daily_orientation:plan:s1").days["2026-10-07"].off).toEqual(["школа"]);

    // The wall: a different device, so nothing of the phone's in its storage.
    window.localStorage.clear();
    useAppStore.setState({ activeStudentId: "s1", students: [student] });
    const wall = await mount(<DailyOrientationRenderer sessionParams={params} soundEnabled={false} accountKv={account.kv} />);
    await act(async () => {});
    const first = wall.querySelector(".daily-orientation__myday-part--morning .daily-orientation__myday-item");
    expect(first.classList.contains("daily-orientation__myday-item--cancelled")).toBe(true);
    expect(first.textContent).toContain("НЕ БУДЕТ");
  });

  it("shows nothing without a student", async () => {
    const el = await mount(<PlanTodayEditor params={{}} student={null} kv={fakeAccount().kv} />);
    expect(el.textContent).toBe("");
  });
});
