import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorksheetMode from "./WorksheetMode.jsx";
import { buildWorksheet, normalizeConfig } from "./sections";

vi.mock("@/shared/components/RewardVideoModal", () => ({ default: ({ onDismiss }) => <button type="button" className="reward-stub" onClick={onDismiss}>видео</button> }));

describe("«Контрольная работа» constructor", () => {
  let container = null;
  let root = null;
  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    window.localStorage.clear();
  });

  function mount(props = {}) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<WorksheetMode task={{ type: "operation_worksheet", cardId: "c", conceptId: "c" }} onCorrect={props.onCorrect ?? (() => {})} student={{ rewardVideos: [] }} accountKv={props.accountKv} />); });
  }
  const click = (el) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  const byText = (text) => [...container.querySelectorAll("button")].find((b) => b.textContent.trim() === text);

  it("adds and removes sections, remembers the test on the device and in the account", () => {
    const put = vi.fn();
    mount({ accountKv: { list: () => Promise.resolve([]), put } });
    expect(container.querySelectorAll(".ws-section")).toHaveLength(4);
    click(container.querySelector(".ws-add-btn"));
    click([...container.querySelectorAll(".ws-add__item")].find((b) => b.textContent.includes("Поставь знак")));
    expect(container.querySelectorAll(".ws-section")).toHaveLength(5);
    expect(put).toHaveBeenCalledWith("addition_subtraction:worksheet:last", expect.objectContaining({ config: expect.any(Object) }));
    expect(JSON.parse(window.localStorage.getItem("mirocard:addition_subtraction:worksheet")).config.sections).toHaveLength(5);
    click(container.querySelectorAll(".ws-section__del")[4]);
    expect(container.querySelectorAll(".ws-section")).toHaveLength(4);
  });

  it("solving all right gives full marks; «Готово» shows the video, then finishes", () => {
    const config = normalizeConfig({ title: "Т", seed: 3, sections: [{ type: "one", count: 2 }, { type: "sign", count: 2 }] });
    window.localStorage.setItem("mirocard:addition_subtraction:worksheet", JSON.stringify({ config, savedAt: 1 }));
    const sheet = buildWorksheet(config);
    const onCorrect = vi.fn();
    mount({ onCorrect });
    click(byText("Решать на экране"));
    for (const item of sheet.sections[0].items) {
      for (const d of String(item.answers[0])) click([...container.querySelectorAll(".ws-keypad button")].find((b) => b.textContent === d));
      click(container.querySelector('[aria-label="Следующая клетка"]'));
    }
    click(byText("Дальше →"));
    for (const item of sheet.sections[1].items) click(container.querySelector(item.answers[0] === "add" ? ".ws-key--plus" : ".ws-key--minus"));
    click(byText("Проверить"));
    expect(container.querySelector(".ws-results__big").textContent).toBe("4 из 4");
    expect(container.querySelector(".ws-results__mistakes")).toBeNull();
    click(byText("Готово"));
    click(container.querySelector(".reward-stub"));
    expect(onCorrect).toHaveBeenCalledWith("c", "c");
  });
});
