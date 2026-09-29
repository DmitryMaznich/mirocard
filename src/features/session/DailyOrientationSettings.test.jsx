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

  it("edits the weekly plan per day and stores it in the renderer's «Пн: …» format", () => {
    mount({ weeklyPlan: "Пн: Школа" });
    const sunday = container.querySelector("#dos-week-0");
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    act(() => {
      setValue.call(sunday, "Гости у бабушки ");
      sunday.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(latest.weeklyPlan).toBe("Пн: Школа\nВс: Гости у бабушки");
    expect(sunday.value).toBe("Гости у бабушки ");
  });
});
