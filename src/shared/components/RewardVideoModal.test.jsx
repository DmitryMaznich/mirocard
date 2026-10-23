import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState, useEffect, useReducer, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import RewardVideoModal from "./RewardVideoModal.jsx";
import { recordRewardVideoView } from "@/core/rewardVideoViews";

vi.mock("@/core/rewardVideoViews", () => ({ recordRewardVideoView: vi.fn(async () => {}) }));

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
let playerEvents;
let destroyPlayer;
let playerInstance;
let autoReady;
let roots;
function createTestRoot() {
  const root = createRoot(container);
  roots.push(root);
  return root;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const PLAYING = 1;
const PAUSED = 2;
async function setPlayerState(state) {
  await act(async () => playerEvents.onStateChange({ data: state }));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  playerEvents = null;
  playerInstance = null;
  autoReady = true;
  roots = [];
  destroyPlayer = vi.fn();
  window.YT = {
    Player: vi.fn(function (_iframe, { events }) {
      playerEvents = events;
      this.destroy = destroyPlayer;
      this.loadVideoById = vi.fn();
      this.unMute = vi.fn();
      this.playVideo = vi.fn();
      playerInstance = this;
      if (autoReady) Promise.resolve().then(() => events.onReady({ target: this }));
    }),
  };
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(async () => {
  for (const root of roots) await act(async () => root.unmount());
  delete window.YT;
  vi.useRealTimers();
  container.remove();

});
describe("RewardVideoModal", () => {
  it("counts only a playing video, once despite parent re-renders", async () => {
    const root = createTestRoot();
    await act(async () => root.render(<ChurningParent tickMs={300} />));
    expect(recordRewardVideoView).not.toHaveBeenCalled();
    await act(async () => container.querySelector(".reward-modal__btn--watch").click());
    expect(recordRewardVideoView).not.toHaveBeenCalled();
    await setPlayerState(PLAYING);
    expect(recordRewardVideoView).toHaveBeenCalledExactlyOnceWith("s1", "aaaaaaaaaaa");
    await act(async () => vi.advanceTimersByTime(1500));
    expect(recordRewardVideoView).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });
  it("auto-dismisses at ~120s even when the caller re-renders every 300ms with a fresh onDismiss (regression: column_addition's Контрольная работа never timed out)", async () => {
    const root = createTestRoot();
    await act(async () => {
      root.render(<ChurningParent tickMs={300} />);
    });

    await act(async () => {
      container.querySelector(".reward-modal__btn--watch")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector(".video-reward-overlay")).toBeTruthy();
    await setPlayerState(PLAYING);

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
    const root = createTestRoot();
    await act(async () => { root.render(<Parent />); });
    await act(async () => {
      container.querySelector(".reward-modal__btn--watch")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await setPlayerState(PLAYING);
    const steps = Math.ceil(121_000 / 1000);
    for (let i = 0; i < steps; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    }

    expect(calls).toEqual([0]); // fired exactly once, with the (only) live generation
  });

  it("uses a threshold-neutral default title and a generic watch-video button label", async () => {
    // Regression: the old hardcoded default ("Молодец! Пять правильных
    // подряд!") lied whenever a student's streak threshold wasn't 5
    // (answersPerStar 2 or 3 -> 10 or 15), and callers unrelated to the
    // streak mechanism (column_addition's Контрольная работа, chat's
    // reward button) never had a "five in a row" to report at all.
    const root = createTestRoot();
    await act(async () => {
      root.render(
        <RewardVideoModal rewardVideos={["https://youtu.be/aaaaaaaaaaa"]} studentId="s1" onDismiss={() => {}} />
      );
    });
    expect(container.querySelector(".reward-modal__title").textContent).toBe("Молодец! 🎉");
    expect(container.querySelector(".reward-modal__btn--watch").textContent).toContain("Смотреть видео");
    expect(container.querySelector(".reward-modal__btn--watch").textContent).not.toContain("мультик");
  });

  it("still supports a caller-supplied title (e.g. SessionScreen's real streak count)", async () => {
    const root = createTestRoot();
    await act(async () => {
      root.render(
        <RewardVideoModal
          rewardVideos={["https://youtu.be/aaaaaaaaaaa"]}
          studentId="s1"
          onDismiss={() => {}}
          title="Молодец! 10 правильных подряд!"
        />
      );
    });
    expect(container.querySelector(".reward-modal__title").textContent).toBe("Молодец! 10 правильных подряд!");
  });

  it("keeps native Play tappable and does not spend reward time when autoplay is blocked", async () => {
    const root = createTestRoot();
    const dismiss = vi.fn();
    await act(async () => root.render(
      <RewardVideoModal rewardVideos={["https://youtu.be/aaaaaaaaaaa"]} studentId="s1" onDismiss={dismiss} />
    ));
    await act(async () => container.querySelector(".reward-modal__btn--watch").click());
    const iframe = container.querySelector("iframe");
    expect(playerInstance.loadVideoById).toHaveBeenCalledExactlyOnceWith("aaaaaaaaaaa");
    expect(new URL(iframe.src).searchParams.get("enablejsapi")).toBe("1");
    expect(iframe.style.pointerEvents).toBe("auto");
    expect(container.querySelector(".video-reward-blocker")).toBeNull();
    const touch = new Event("touchstart", { bubbles: true, cancelable: true });
    iframe.dispatchEvent(touch);
    expect(touch.defaultPrevented).toBe(false);
    await act(async () => vi.advanceTimersByTime(130000));
    expect(dismiss).not.toHaveBeenCalled();
    expect(recordRewardVideoView).not.toHaveBeenCalled();
    expect(container.querySelector(".video-reward-progress__label").textContent).toBe("2:00");

    await setPlayerState(PLAYING);
    expect(iframe.style.pointerEvents).toBe("none");
    expect(container.querySelector(".video-reward-blocker")).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(1000));
    expect(container.querySelector(".video-reward-progress__label").textContent).toBe("1:59");
    await act(async () => root.unmount());
    expect(destroyPlayer).toHaveBeenCalledOnce();
  });

  it("pauses the countdown during buffering or pause, then resumes without counting another view", async () => {
    const root = createTestRoot();
    const dismiss = vi.fn();
    await act(async () => root.render(
      <RewardVideoModal rewardVideos={["https://youtu.be/aaaaaaaaaaa"]} studentId="s1" onDismiss={dismiss} />
    ));
    await act(async () => container.querySelector(".reward-modal__btn--watch").click());
    await setPlayerState(PLAYING);
    await act(async () => vi.advanceTimersByTime(2000));
    for (const state of [PAUSED, 3]) {
      await setPlayerState(state);
      await act(async () => vi.advanceTimersByTime(10000));
      expect(container.querySelector(".video-reward-progress__label").textContent).toBe("1:58");
      expect(container.querySelector(".video-reward-blocker")).toBeNull();
    }
    await setPlayerState(PLAYING);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(container.querySelector(".video-reward-progress__label").textContent).toBe("1:57");
    expect(recordRewardVideoView).toHaveBeenCalledTimes(1);
    expect(dismiss).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("unblocks interaction and stops the countdown on a YouTube error; close still works", async () => {
    const root = createTestRoot();
    const dismiss = vi.fn();
    await act(async () => root.render(
      <RewardVideoModal rewardVideos={["https://youtu.be/aaaaaaaaaaa"]} studentId="s1" onDismiss={dismiss} />
    ));
    await act(async () => container.querySelector(".reward-modal__btn--watch").click());
    await setPlayerState(PLAYING);
    await act(async () => playerEvents.onError({ data: 150 }));
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    expect(container.querySelector(".video-reward-blocker")).toBeNull();
    await act(async () => vi.advanceTimersByTime(130000));
    expect(dismiss).not.toHaveBeenCalled();
    await act(async () => container.querySelector(".video-reward-close").click());
    expect(dismiss).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it("dismisses once when a short video ends after playback starts", async () => {
    const root = createTestRoot();
    const dismiss = vi.fn();
    await act(async () => root.render(
      <RewardVideoModal rewardVideos={["https://youtu.be/aaaaaaaaaaa"]} onDismiss={dismiss} />
    ));
    await act(async () => container.querySelector(".reward-modal__btn--watch").click());
    await setPlayerState(0);
    expect(dismiss).not.toHaveBeenCalled();
    await setPlayerState(PLAYING);
    await setPlayerState(0);
    await setPlayerState(0);
    expect(dismiss).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it("reports an unavailable API without spending reward time and allows a later retry", async () => {
    delete window.YT;
    const root = createTestRoot();
    const dismiss = vi.fn();
    await act(async () => root.render(
      <RewardVideoModal rewardVideos={["https://youtu.be/aaaaaaaaaaa"]} onDismiss={dismiss} />
    ));
    await act(async () => container.querySelector(".reward-modal__btn--watch").click());
    expect(document.getElementById("reward-youtube-api")).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(15000));
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    expect(document.getElementById("reward-youtube-api")).toBeNull();
    expect(container.querySelector(".reward-modal__btn--watch").disabled).toBe(true);
    expect(dismiss).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
  });

  it("prepares the iframe before Watch and starts in the same click without replacing it", async () => {
    autoReady = false;
    const root = createTestRoot();
    await act(async () => root.render(
      <RewardVideoModal rewardVideos={["https://youtu.be/aaaaaaaaaaa"]} onDismiss={() => {}} />
    ));
    const iframe = container.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(new URL(iframe.src).searchParams.get("autoplay")).toBe("0");
    expect(container.querySelector(".reward-modal__btn--watch").disabled).toBe(true);
    await act(async () => playerEvents.onReady({ target: playerInstance }));
    expect(playerInstance.loadVideoById).not.toHaveBeenCalled();
    expect(playerInstance.playVideo).not.toHaveBeenCalled();
    expect(recordRewardVideoView).not.toHaveBeenCalled();
    expect(container.querySelector(".video-reward-overlay").style.visibility).toBe("hidden");

    let insideClick = false;
    playerInstance.loadVideoById.mockImplementation(() => {
      expect(insideClick).toBe(true);
      expect(container.querySelector("iframe")).toBe(iframe);
      expect(container.querySelector(".video-reward-overlay").style.visibility).toBe("visible");
    });
    await act(async () => {
      insideClick = true;
      container.querySelector(".reward-modal__btn--watch").click();
      insideClick = false;
    });
    expect(playerInstance.unMute).toHaveBeenCalledOnce();
    expect(playerInstance.loadVideoById).toHaveBeenCalledExactlyOnceWith("aaaaaaaaaaa");
    expect(window.YT.Player).toHaveBeenCalledTimes(1);
    await setPlayerState(PLAYING);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(container.querySelector(".video-reward-progress__label").textContent).toBe("1:59");
    await act(async () => root.unmount());
  });

  it("recreates the preloaded iframe safely under StrictMode without starting hidden playback", async () => {
    const root = createTestRoot();
    await act(async () => root.render(
      <StrictMode><RewardVideoModal rewardVideos={["https://youtu.be/aaaaaaaaaaa"]} onDismiss={() => {}} /></StrictMode>
    ));
    expect(container.querySelectorAll("iframe")).toHaveLength(1);
    expect(playerInstance.loadVideoById).not.toHaveBeenCalled();
    expect(container.querySelector(".reward-modal__btn--watch").disabled).toBe(false);
    await act(async () => container.querySelector(".reward-modal__btn--watch").click());
    expect(playerInstance.loadVideoById).toHaveBeenCalledExactlyOnceWith("aaaaaaaaaaa");
    await setPlayerState(PLAYING);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(container.querySelector(".video-reward-progress__label").textContent).toBe("1:59");
    await act(async () => root.unmount());
    expect(container.querySelectorAll("iframe")).toHaveLength(0);
  });

});
