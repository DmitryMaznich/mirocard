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
    expect([latest.showAnalogClock, latest.showDigitalTime, latest.showTimeWords]).toEqual([false, false, false]);
    expect(container.querySelector(".dos-chips")).toBeNull();
  });

  it("never lets the last visible card be hidden", () => {
    mount({
      showDayOfMonth: false, showMonth: false, showSeason: false, showDaypart: false,
      showWeather: false, showAnalogClock: false, showDigitalTime: false, showTimeWords: false,
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

  it("adds a new event with the picture suggested for its word, in the stored «Пн: …» form", () => {
    mount({ weeklyPlan: "Пн: 🏫 Школа" });
    act(() => button(/^Добавить дело: Понедельник/).click());
    typeInto(container.querySelector("#dos-plan-new"), "Бассейн");
    act(() => container.querySelector(".dos-plan__panel form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(latest.weeklyPlan).toBe("Пн: 🏫 Школа, 🏊 Бассейн");
  });

  it("adds one of the week's own events with one tap", () => {
    mount({ weeklyPlan: "Пн: 🏫 Школа, 👟 Спорт" });
    act(() => button(/^Добавить дело: Вторник/).click());
    act(() => Array.from(container.querySelectorAll(".dos-plan__chip--own")).find((el) => /Спорт/.test(el.textContent)).click());
    expect(latest.weeklyPlan).toBe("Пн: 🏫 Школа, 👟 Спорт\nВт: 👟 Спорт");
  });

  it("fills an empty day like the nearest filled day before it", () => {
    mount({ weeklyPlan: "Пн: 🏫 Школа, 👟 Спорт" });
    act(() => button(/^Как в понедельник/).click());
    expect(latest.weeklyPlan).toBe("Пн: 🏫 Школа, 👟 Спорт\nВт: 🏫 Школа, 👟 Спорт");
  });

  it("moves, re-pictures (in every day) and removes an event", () => {
    mount({ weeklyPlan: "Пн: 🏫 Школа, Спорт\nСр: Спорт" });
    act(() => button(/^Спорт: изменить/).click());
    act(() => button(/^← Раньше/).click());
    expect(latest.weeklyPlan).toBe("Пн: Спорт, 🏫 Школа\nСр: Спорт");
    act(() => button(/^Картинка$/).click());
    act(() => button(/^👟$/).click());
    expect(latest.weeklyPlan).toBe("Пн: 👟 Спорт, 🏫 Школа\nСр: 👟 Спорт");
    act(() => button(/^Убрать/).click());
    expect(latest.weeklyPlan).toBe("Пн: 🏫 Школа\nСр: 👟 Спорт");
  });

  it("removes the photo of an item that left the week, and drops the photo when an emoji is picked", () => {
    mount({ weeklyPlan: "Пн: 👟 Спорт, 🛏️ Спать", planPhotos: '{"спорт":"/api/photos/a","спать":"/api/photos/b"}' });
    act(() => button(/^Спать: изменить/).click());
    act(() => button(/^Убрать/).click());
    expect(JSON.parse(latest.planPhotos)).toEqual({ "спорт": "/api/photos/a" });
    act(() => button(/^Спорт: изменить/).click());
    act(() => button(/^Картинка$/).click());
    act(() => button(/^⚽$/).click());
    expect(latest.weeklyPlan).toBe("Пн: ⚽ Спорт");
    expect(latest.planPhotos).toBe("");
  });
});
