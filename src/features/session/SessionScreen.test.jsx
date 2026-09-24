import { describe, expect, it } from "vitest";
import { shouldPreferBundledRenderer, shouldShowSessionStreak } from "./SessionScreen";

describe("shouldShowSessionStreak", () => {
  it("shows stars for evaluated spatial modes with an active video reward", () => {
    expect(shouldShowSessionStreak({
      mode: { type: "spatial_recognize", evaluation: "auto" },
      renderer: "spatial_prepositions",
      rewardAvailable: true,
    })).toBe(true);
  });

  it("keeps the header minimal when the spatial reward is unavailable", () => {
    expect(shouldShowSessionStreak({
      mode: { type: "spatial_recognize", evaluation: "auto" },
      renderer: "spatial_prepositions",
      rewardAvailable: false,
    })).toBe(false);
  });

  it("does not show reward stars for unscored spatial modes", () => {
    expect(shouldShowSessionStreak({
      mode: { type: "spatial_introduction", evaluation: "none" },
      renderer: "spatial_prepositions",
      rewardAvailable: true,
    })).toBe(false);
  });
});

describe("shouldPreferBundledRenderer", () => {
  it("does not let a legacy deck renderer override spatial prepositions", () => {
    expect(shouldPreferBundledRenderer("spatial_prepositions")).toBe(true);
  });

  it("keeps supporting dynamic renderers for other topics", () => {
    expect(shouldPreferBundledRenderer("flashcards")).toBe(false);
  });
});

describe("SessionScreen paid-topic lock (single choke point for every entry path)", () => {
  it("shows the expired-access screen instead of starting a lapsed paid topic", async () => {
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { useAppStore } = await import("@/core/store");
    const { default: SessionScreen } = await import("./SessionScreen");
    const setScreen = (await import("vitest")).vi.fn();
    useAppStore.setState({
      activeTopicId: "paid_x",
      ownedTopics: [{ topicId: "paid_x", source: "paid" }],
      account: { featureFlags: [] },
      subscription: { plan: "monthly", status: "active", currentPeriodEnd: "2000-01-01T00:00:00.000Z" },
      setScreen,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<SessionScreen />));
    expect(container.textContent).toContain("Доступ закончился");
    const renew = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Продлить доступ");
    act(() => renew.click());
    expect(setScreen).toHaveBeenCalledWith("subscription");
    act(() => root.unmount());
    container.remove();
  });
});
