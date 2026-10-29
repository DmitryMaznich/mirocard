import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import { useInstallPrompt } from "./useInstallPrompt.js";

const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function probe({ userAgent, maxTouchPoints = 0, displayMode = "browser" }) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  Object.defineProperty(navigator, "maxTouchPoints", { value: maxTouchPoints, configurable: true });
  vi.stubGlobal("matchMedia", (query) => ({ matches: query === `(display-mode: ${displayMode})`, addEventListener() {}, removeEventListener() {} }));
  let result;
  function Probe() { result = useInstallPrompt(); return null; }
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<Probe />));
  act(() => root.unmount());
  return result;
}

describe("useInstallPrompt — iOS detection", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

  it("shows the install guide banner on an iPhone", () => {
    const r = probe({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5 });
    expect(r.isIos).toBe(true);
    expect(r.visible).toBe(true);
  });

  it("treats iPadOS Safari, which reports itself as a Mac, as iOS", () => {
    const r = probe({ userAgent: MAC_SAFARI, maxTouchPoints: 5 });
    expect(r.isIos).toBe(true);
    expect(r.visible).toBe(true);
  });

  it("does not treat a real Mac (no touch screen) as iOS", () => {
    const r = probe({ userAgent: MAC_SAFARI, maxTouchPoints: 0 });
    expect(r.isIos).toBe(false);
    expect(r.visible).toBe(false);
  });

  it("offers Firefox Android a manual install path without beforeinstallprompt", () => {
    const r = probe({ userAgent: "Mozilla/5.0 (Android 15; Mobile; rv:147.0) Gecko/147.0 Firefox/147.0" });
    expect(r.visible).toBe(true);
    expect(r.isFirefoxAndroid).toBe(true);
    expect(r.hasNativePrompt).toBe(false);
  });

  it("keeps Firefox on iOS on the iOS install path", () => {
    const r = probe({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/147.0 Mobile/15E148 Safari/605.1.15" });
    expect(r.isIos).toBe(true);
    expect(r.isFirefoxAndroid).toBe(false);
  });

  it.each(["standalone", "fullscreen"])("does not offer installation in an existing %s app window", (displayMode) => {
    const r = probe({ userAgent: "Mozilla/5.0 (Android 15; Mobile; rv:147.0) Gecko/147.0 Firefox/147.0", displayMode });
    expect(r.visible).toBe(false);
  });

  it("respects a dismissed Firefox install banner", () => {
    localStorage.setItem("installBannerDismissedAt", String(Date.now()));
    const r = probe({ userAgent: "Mozilla/5.0 (Android 15; Mobile; rv:147.0) Gecko/147.0 Firefox/147.0" });
    expect(r.visible).toBe(false);
  });
});

