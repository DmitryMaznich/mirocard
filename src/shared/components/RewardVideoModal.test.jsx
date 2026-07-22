import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState, useEffect, useReducer } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import RewardVideoModal from "./RewardVideoModal.jsx";

// A parent that re-renders on its own unrelated tick, recreating an inline
// onDismiss closure every time — the same pattern column_addition's
// ColumnCopyView uses (not memoized), as opposed to callers that pass a
// stable callback (SessionScreen's clearRewardPending, reading's onAdvance).
function ChurningParent({ tickMs }) {
  const [, forceTick] = useReducer((c) => c + 1, 0);
  useEffect(() => {
    if (!tickMs) return undefined;
    const i = setInterval(forceTick, tickMs);
    return () => clearInterval(i);
  }, [tickMs]);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return <div id="dismissed-marker" />;
  return (
    <RewardVideoModal
      rewardVideos={["https://youtu.be/aaaaaaaaaaa"]}
      studentId="s1"
      onDismiss={() => setDismissed(true)}
    />
  );
}

let container;
beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(() => {
  vi.useRealTimers();
  container.remove();
});

describe("RewardVideoModal", () => {
  it("auto-dismisses at ~120s even when the caller re-renders every 300ms with a fresh onDismiss (regression: column_addition's Контрольная работа never timed out)", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<ChurningParent tickMs={300} />);
    });

    await act(async () => {
      container.querySelector(".reward-modal__btn--watch")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector(".video-reward-overlay")).toBeTruthy();

    // Step in 300ms increments (each its own act(), like real separate
    // setInterval macrotasks) rather than one big jump — a single jump lets
    // fake-timers batch every tick into one React render, which would hide
    // exactly the bug this test guards against.
    const steps = Math.ceil(121_000 / 300);
    for (let i = 0; i < steps; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
      if (container.querySelector("#dismissed-marker")) break;
    }

    expect(container.querySelector("#dismissed-marker")).toBeTruthy();
  });

  it("still calls the latest onDismiss (not a stale closure) when time runs out", async () => {
    const calls = [];
    function Parent() {
      const [gen, setGen] = useState(0);
      return (
        <RewardVideoModal
          rewardVideos={["https://youtu.be/aaaaaaaaaaa"]}
          studentId="s1"
          onDismiss={() => { calls.push(gen); setGen((g) => g + 1); }}
        />
      );
    }
    const root = createRoot(container);
    await act(async () => { root.render(<Parent />); });
    await act(async () => {
      container.querySelector(".reward-modal__btn--watch")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const steps = Math.ceil(121_000 / 1000);
    for (let i = 0; i < steps; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    }

    expect(calls).toEqual([0]); // fired exactly once, with the (only) live generation
  });
});
