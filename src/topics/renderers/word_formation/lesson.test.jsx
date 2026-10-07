import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
const { speak } = vi.hoisted(() => ({ speak: vi.fn() }));
vi.mock("@/shared/hooks/useSpeech", () => ({ useSpeech: () => ({ speak }) }));
vi.mock("@/shared/hooks/useTopicFile", () => ({ useTopicFile: () => "data:image/svg+xml,<svg/>" }));
import Renderer from "./index";

const card = { id: "fish", conceptId: "fish-concept", nounPhrase: "суп из рыбы", adjPhrase: "рыбный суп", ingredientImage: "fish.webp" };
let root, container;
function mount(task, props = {}) {
  vi.stubGlobal("speechSynthesis", {});
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Renderer task={task} topicId="word_formation_soup" {...props} />));
}
function click(label) {
  const button = [...container.querySelectorAll("button")].find(b => b.textContent === label || b.getAttribute("aria-label") === label);
  expect(button, label).toBeTruthy();
  act(() => button.click());
}
afterEach(() => {
  act(() => root?.unmount()); container?.remove();
  vi.unstubAllGlobals(); vi.clearAllMocks();
});

describe("lesson states without additional modes", () => {
  it("does not reveal question or colored endings in an agreement check", () => {
    mount({ type: "season_form_pick", card: { id: "autumn", contextPhrase: "Наступила осень" },
      item: { id: "morning", adjPhrase: "осеннее утро" }, params: { activityStage: "check", questionHint: true } });
    expect(container.querySelector(".wf-sfp--check")).toBeTruthy();
    expect(container.querySelector(".wf-sfp__label--q").textContent).toBe("утро");
  });
  it("keeps the oral answer clean and never logs navigation as correctness", () => {
    const onQualityAnswer = vi.fn();
    const onAdvance = vi.fn();
    mount({ type: "pair_intro", cards: [card], params: { introStage: "answer" } }, { onQualityAnswer, onAdvance });
    expect(container.querySelector(".wf-lesson__model")).toBeNull();
    expect(container.textContent).not.toContain("рыбный суп");
    expect(container.querySelector(".wf-lesson__adult")).toBeNull();
    expect(container.querySelector(".wf-lesson__actions")).toBeNull();
    click("Следующая пара");
    expect(onAdvance).toHaveBeenCalledOnce();
    expect(onQualityAnswer).not.toHaveBeenCalled();
  });
  it("shows the configured model without switching controls or grading", () => {
    const onQualityAnswer = vi.fn();
    mount({ type: "pair_intro", cards: [card] }, { onQualityAnswer });
    expect(container.querySelector(".wf-lesson__model").textContent).toContain("рыбный суп");
    expect(container.querySelector(".wf-lesson__actions")).toBeNull();
    expect(container.querySelector(".wf-lesson__adult")).toBeNull();
    expect(onQualityAnswer).not.toHaveBeenCalled();
  });
  it("offers only optional condition audio, without audio on choices", () => {
    const onCorrect = vi.fn(), onIncorrect = vi.fn();
    mount({ type: "pick_form", card, params: { speechEnabled: true }, options: [{ text: "рыбный", isTarget: true }, { text: "мясной", isTarget: false }] }, { onCorrect, onIncorrect });
    expect(container.querySelectorAll(".wf-listen")).toHaveLength(1);
    click("Послушать условие");
    expect(speak).toHaveBeenCalledWith("Суп из рыбы");
    expect(onCorrect).not.toHaveBeenCalled(); expect(onIncorrect).not.toHaveBeenCalled();
    click("рыбный");
    expect(onCorrect).toHaveBeenCalledWith("fish-concept", "fish");
    expect(container.querySelector(".wf-lesson__model").textContent).toContain("рыбный суп");
  });
  it("respects the disabled sound setting", () => {
    mount({ type: "pair_intro", cards: [card] }, { soundEnabled: false });
    expect(container.querySelector(".wf-listen")).toBeNull();
    expect(speak).not.toHaveBeenCalled();
  });
  it("records a child's wrong selection once without a manual grading panel", () => {
    const onCorrect = vi.fn(), onIncorrect = vi.fn();
    mount({ type: "pick_form", card, options: [{ text: "рыбный", isTarget: true }, { text: "мясной", isTarget: false }] }, { onCorrect, onIncorrect });
    click("мясной"); click("мясной");
    expect(onIncorrect).toHaveBeenCalledExactlyOnceWith("fish-concept", "fish");
    expect(onCorrect).not.toHaveBeenCalled();
    expect(container.querySelector(".wf-lesson__adult")).toBeNull();
  });
  it.each(["juice", "jam", "kasha", "materials"])("uses source → result instead of a generic vessel in %s", category => {
    mount({ type: "pair_intro", cards: [{ ...card, category, noun: "продукт", image: "result.webp", vesselImage: "vessel.webp" }] });
    expect(container.querySelectorAll(".wf-meaning__figure")).toHaveLength(2);
    expect(container.querySelector(".wf-pair__plus")).toBeNull();
    expect(container.querySelector(".wf-meaning__link").textContent).toContain(category === "materials" ? "делаем" : "готовим");
  });
  it("records the first answer even if two buttons are tapped before a render", () => {
    const onCorrect = vi.fn(), onIncorrect = vi.fn();
    mount({ type: "pick_form", card, options: [{ text: "рыбный", isTarget: true }, { text: "мясной", isTarget: false }] }, { onCorrect, onIncorrect });
    const buttons = container.querySelectorAll(".wf-pick__option");
    act(() => { buttons[1].click(); buttons[0].click(); });
    expect(onIncorrect).toHaveBeenCalledOnce();
    expect(onCorrect).not.toHaveBeenCalled();
  });
  it("does not reveal the right agreement option after an error in a check", () => {
    const onIncorrect = vi.fn();
    mount({ type: "season_form_pick", card: { id: "autumn", contextPhrase: "Наступила осень" },
      item: { id: "morning", adjPhrase: "осеннее утро" }, params: { activityStage: "check" },
      options: [{ key: "ее", ending: "ее", isTarget: true }, { key: "яя", ending: "яя", isTarget: false }] }, { onIncorrect });
    click("осенняя");
    expect(onIncorrect).toHaveBeenCalledExactlyOnceWith("autumn", "autumn:morning");
    expect(container.querySelector('[role="status"]').textContent).toBe("Посмотрим вместе");
    expect(container.querySelector(".wf-sfp__btn--reveal, .wf-sfp__btn--dim")).toBeNull();
    expect(container.querySelector(".wf-sfp__label--a").getAttribute("aria-hidden")).toBe("true");
  });
  it.each(["pair_intro", "pick_form", "season_form_pick"])("keeps meaning when images are disabled in %s", type => {
    mount({ type, card: { ...card, category: "soup" }, cards: [card], item: { id: "dish", sourcePhrase: "блюдо из рыбы", adjPhrase: "рыбное блюдо" }, params: { showImage: false } });
    expect(container.querySelector("img, .wf-meaning")).toBeNull();
    expect(container.textContent).toContain(type === "season_form_pick" ? "блюдо из рыбы" : "Суп из рыбы");
  });
});
