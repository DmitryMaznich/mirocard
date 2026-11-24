import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import DailyOrientationSettings from "./DailyOrientationSettings.jsx";

describe("DailyOrientationSettings", () => {
  let container;
  let root;
  let latest;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function mount(initial) {
    function Harness() {
      const [params, setParams] = useState(initial);
      latest = params;
      return <DailyOrientationSettings params={params} setParams={setParams} />;
    }
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
  }

  const button = (pattern) => Array.from(container.querySelectorAll("button"))
    .find((el) => pattern.test(el.getAttribute("aria-label") ?? el.textContent));

  it("toggles a card on the screen map and names what is hidden", () => {
    mount({});
    act(() => button(/^Погода:/).click());
    expect(latest.showWeather).toBe(false);
    expect(container.querySelector(".dos-summary").textContent).toBe("Скрыто: погода");
  });

  it("switches the whole clock card at once and hides its sub-options with it", () => {
    mount({});
    act(() => button(/^Время:/).click());
    expect([latest.showDigitalTime, latest.showTimeWords]).toEqual([false, false]);
    expect(container.querySelector(".dos-chips")).toBeNull();
  });

  it("never lets the last visible card be hidden", () => {
    mount({
      showDayOfMonth: false, showMonth: false, showSeason: false, showDaypart: false,
      showWeather: false, showDigitalTime: false, showTimeWords: false, showPlan: false,
    });
    act(() => button(/^День недели:/).click());
    expect(latest.showWeekday).not.toBe(false);
  });

  const typeInto = (input, value) => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    act(() => {
      setValue.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("shows a plan saved as one line per day as separate events", () => {
    mount({ weeklyPlan: "Пн: 🏫 Школа, спорт" });
    expect(button(/^Школа: изменить/)).toBeTruthy();
    expect(button(/^спорт: изменить/)).toBeTruthy();
  });

  const partRadio = (group, name) => Array.from(group.querySelectorAll('[role="radio"]')).find((el) => el.textContent === name);

  it("adds a new event in the chosen part of the day, with the picture suggested for its word", () => {
    mount({ weeklyPlan: "Пн: 🏫 Школа [утро]" });
    act(() => button(/^Добавить дело: Понедельник/).click());
    const panel = container.querySelector(".dos-plan__panel");
    // New events go after the day's last waking part by default.
    expect(partRadio(panel, "Утро").getAttribute("aria-checked")).toBe("true");
    act(() => partRadio(panel, "День").click());
    typeInto(container.querySelector("#dos-plan-new"), "Бассейн");
    act(() => panel.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(latest.weeklyPlan).toBe("Пн: 🏫 Школа [утро], 🏊 Бассейн [день]");
  });

  it("adds one of the week's own events with one tap, in the chosen part", () => {
    mount({ weeklyPlan: "Пн: 🏫 Школа [утро], 👟 Спорт [день]" });
    act(() => button(/^Добавить дело: Вторник/).click());
    const panel = container.querySelector(".dos-plan__panel");
    act(() => partRadio(panel, "Вечер").click());
    act(() => Array.from(container.querySelectorAll(".dos-plan__chip--own")).find((el) => /Спорт/.test(el.textContent)).click());
    expect(latest.weeklyPlan).toBe("Пн: 🏫 Школа [утро], 👟 Спорт [день]\nВт: 👟 Спорт [вечер]");
  });

  it("fills an empty day like the nearest filled day before it", () => {
    mount({ weeklyPlan: "Пн: 🏫 Школа [утро], 👟 Спорт [день]" });
    act(() => button(/^Как в понедельник/).click());
    expect(latest.weeklyPlan).toBe("Пн: 🏫 Школа [утро], 👟 Спорт [день]\nВт: 🏫 Школа [утро], 👟 Спорт [день]");
  });

  it("moves an event to another part of the day, reorders within a part, re-pictures it everywhere and removes it", () => {
    mount({ weeklyPlan: "Пн: 🏫 Школа [утро], Занимаемся [вечер], Душ [вечер]\nСр: Занимаемся [вечер]" });
    act(() => button(/^Душ: изменить/).click());
    act(() => button(/^← Раньше/).click());
    expect(latest.weeklyPlan).toBe("Пн: 🏫 Школа [утро], Душ [вечер], Занимаемся [вечер]\nСр: Занимаемся [вечер]");
    act(() => button(/^Занимаемся: изменить/).click());
    // The first of its part can't go «earlier» into another part: that's the part buttons' job.
    expect(button(/^Позже/).disabled).toBe(true);
    act(() => partRadio(container.querySelector(".dos-plan__day"), "День").click());
    expect(latest.weeklyPlan).toBe("Пн: 🏫 Школа [утро], Занимаемся [день], Душ [вечер]\nСр: Занимаемся [вечер]");
    act(() => button(/^Картинка$/).click());
    act(() => button(/^📚$/).click());
    expect(latest.weeklyPlan).toBe("Пн: 🏫 Школа [утро], 📚 Занимаемся [день], Душ [вечер]\nСр: 📚 Занимаемся [вечер]");
    act(() => button(/^Убрать/).click());
    expect(latest.weeklyPlan).toBe("Пн: 🏫 Школа [утро], Душ [вечер]\nСр: 📚 Занимаемся [вечер]");
  });

  it("removes the photo of an item that left the week, and drops the photo when an emoji is picked", () => {
    mount({ weeklyPlan: "Пн: 👟 Спорт [день], 🛏️ Спать [ночь]", planPhotos: '{"спорт":"/api/photos/a","спать":"/api/photos/b"}' });
    act(() => button(/^Спать: изменить/).click());
    act(() => button(/^Убрать/).click());
    expect(JSON.parse(latest.planPhotos)).toEqual({ "спорт": "/api/photos/a" });
    act(() => button(/^Спорт: изменить/).click());
    act(() => button(/^Картинка$/).click());
    act(() => button(/^⚽$/).click());
    expect(latest.weeklyPlan).toBe("Пн: ⚽ Спорт [день]");
    expect(latest.planPhotos).toBe("");
  });

  it("moves a border of the day bar by an hour, never past its neighbour", () => {
    const slider = (name) => container.querySelector(`[role="slider"][aria-label="${name}"]`);
    const key = (el, k) => act(() => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })));
    mount({ wakeHour: 7, dayHour: 12, eveningHour: 18, bedHour: 21 });
    key(slider("Вечер с"), "ArrowLeft");
    expect(latest.eveningHour).toBe(17);
    act(() => root.unmount()); container.remove();
    mount({ wakeHour: 7, dayHour: 13, eveningHour: 14, bedHour: 21 });
    expect(slider("День с").getAttribute("aria-valuemax")).toBe("13");
    key(slider("День с"), "ArrowRight");
    expect(latest.dayHour).toBe(13);
  });
});

