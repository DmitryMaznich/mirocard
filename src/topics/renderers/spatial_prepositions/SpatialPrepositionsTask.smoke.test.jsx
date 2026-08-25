import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import SpatialPrepositionsRenderer from "./index.jsx";

const CARD = {
  id: "spatial_under_01",
  conceptId: "spatial_under",
  relation: "under",
  subject: "Мяч",
  phrase: "под столом",
  question: "Где мяч?",
  recognizePrompt: "Покажи: мяч под столом.",
  model: "Мяч под столом.",
  image: "media/under.png",
  contrastImage: "media/on.png",
};

describe("spatial prepositions tasks", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null;
    container = null;
  });

  function mount(task, callbacks = {}) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <SpatialPrepositionsRenderer
          task={task}
          topicId="spatial_prepositions_ru"
          soundEnabled={false}
          onCorrect={callbacks.onCorrect ?? (() => {})}
          onIncorrect={callbacks.onIncorrect ?? (() => {})}
          onMistake={callbacks.onMistake ?? (() => {})}
          onAdvance={callbacks.onAdvance ?? (() => {})}
          onCardShown={callbacks.onCardShown ?? (() => {})}
          onTap={callbacks.onTap ?? (() => {})}
        />,
      );
    });
  }

  it("keeps a real pause between the question and the written model", () => {
    const onAdvance = vi.fn();
    mount({ type: "spatial_introduction", card: CARD, modelFirst: false }, { onAdvance });

    expect(container.textContent).toContain("Где мяч?");
    expect(container.textContent).not.toContain("под столом");
    const replayButton = container.querySelector(".sp-audio-button--icon");
    expect(replayButton.getAttribute("aria-label")).toBe("Повторить вопрос");
    expect(replayButton.textContent).toBe("🔊");
    expect(container.querySelector(".sp-actions--question .sp-primary-button").textContent).toBe("Узнать");

    act(() => { container.querySelector(".sp-primary-button").click(); });
    expect(container.textContent).toContain("под столом");
    // The written response stays short; the full sentence is the audio model.
    expect(container.textContent).not.toContain("Мяч под столом.");
    const modelReplayButton = container.querySelector(".sp-audio-button--icon");
    expect(modelReplayButton.getAttribute("aria-label")).toBe("Слушать ещё раз");
    expect(modelReplayButton.textContent).toBe("🔊");
    expect(container.querySelector(".sp-actions--question .sp-primary-button").textContent).toBe("Дальше");

    act(() => { container.querySelector(".sp-primary-button").click(); });
    expect(onAdvance).toHaveBeenCalledOnce();
  });

  it("reports a wrong photo through the shared incorrect-answer event", () => {
    const onIncorrect = vi.fn();
    const onTap = vi.fn();
    mount({
      type: "spatial_recognize",
      card: CARD,
      options: [
        { id: "contrast", image: CARD.contrastImage, isTarget: false },
        { id: "target", image: CARD.image, isTarget: true },
      ],
      showInstructionText: false,
    }, { onIncorrect, onTap });

    act(() => { container.querySelectorAll(".sp-choice")[0].click(); });
    expect(onTap).toHaveBeenCalledWith("contrast", false);
    expect(onIncorrect).toHaveBeenCalledWith("spatial_under", "spatial_under_01");
    expect(container.querySelectorAll(".sp-choice--incorrect")).toHaveLength(1);
    expect(container.querySelectorAll(".sp-choice--target")).toHaveLength(0);
    expect(container.textContent).not.toContain("Мяч под столом.");
    expect(container.textContent).not.toContain("Дальше");
  });

  it("records a correct picture choice and lets the session advance naturally", () => {
    const onCorrect = vi.fn();
    mount({
      type: "spatial_transfer",
      card: CARD,
      options: [
        { id: "target", image: CARD.image, isTarget: true },
        { id: "contrast", image: CARD.contrastImage, isTarget: false },
      ],
      showInstructionText: true,
    }, { onCorrect });

    expect(container.textContent).toContain("Новая картинка");
    expect(container.textContent).toContain(CARD.recognizePrompt);
    act(() => { container.querySelectorAll(".sp-choice")[0].click(); });
    expect(onCorrect).toHaveBeenCalledWith("spatial_under", "spatial_under_01");
    expect(container.querySelectorAll(".sp-choice--target")).toHaveLength(1);
  });

  it("does not score spoken response practice automatically", () => {
    const onAdvance = vi.fn();
    const onCorrect = vi.fn();
    mount({ type: "spatial_respond", card: CARD }, { onAdvance, onCorrect });

    act(() => { container.querySelector(".sp-primary-button").click(); });
    expect(container.textContent).toContain("Мяч под столом.");
    expect(onCorrect).not.toHaveBeenCalled();

    act(() => { container.querySelector(".sp-primary-button").click(); });
    expect(onAdvance).toHaveBeenCalledOnce();
  });
});
