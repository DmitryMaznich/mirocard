import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import DailyOrientationRenderer from "./index.jsx";

describe("DailyOrientationRenderer", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    root = null;
    container = null;
    vi.useRealTimers();
  });

  function mountAt(date) {
    vi.useFakeTimers();
    vi.setSystemTime(date);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<DailyOrientationRenderer />));
  }

  it("shows today by default and updates the date fields through the carousel", () => {
    mountAt(new Date(2026, 8, 22, 14, 35));

    expect(container.textContent).toContain("ВТОРНИК");
    expect(container.textContent).toContain("22-е");
    expect(container.textContent).toContain("СЕНТЯБРЬ");

    const tomorrow = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Завтра");
    act(() => tomorrow.click());

    expect(container.textContent).toContain("СРЕДА");
    expect(container.textContent).toContain("23-е");
    expect(container.textContent).toContain("Какой будет день?");
  });
});
