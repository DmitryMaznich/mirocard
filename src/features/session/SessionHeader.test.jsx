import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import SessionHeader from "./SessionHeader";

describe("SessionHeader", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it("shows reward stars in a compact session header", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <SessionHeader
          topicTitle="Где предмет?"
          modeTitle="Покажи"
          showProgress={false}
          showStreak
          streakCount={2}
          rewardAvailable
          answersPerStar={1}
          taskIndex={0}
          total={15}
          correctCount={2}
          incorrectCount={0}
          evaluation="auto"
          onClose={() => {}}
          tongueLabel="План занятия"
          isDrawerOpen={false}
          onSetDrawerOpen={() => {}}
          hasUndonePlanItems={false}
          answerStatus="task_active"
        />,
      );
    });

    expect(container.querySelectorAll(".star-bar-star")).toHaveLength(5);
    expect(container.querySelectorAll(".star-bar-star--lit")).toHaveLength(2);
  });
});
