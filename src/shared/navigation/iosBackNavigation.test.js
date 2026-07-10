import { afterEach, describe, expect, it, vi } from "vitest";
import { isIOS, installIosRoot, pushIosScreen, getIosNavState } from "./iosBackNavigation";

function mockUserAgent(ua, platform = "iPhone", maxTouchPoints = 5) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
  Object.defineProperty(window.navigator, "platform", { value: platform, configurable: true });
  Object.defineProperty(window.navigator, "maxTouchPoints", { value: maxTouchPoints, configurable: true });
}

const originalNavigatorDescriptors = {
  userAgent: Object.getOwnPropertyDescriptor(window.navigator, "userAgent"),
  platform: Object.getOwnPropertyDescriptor(window.navigator, "platform"),
  maxTouchPoints: Object.getOwnPropertyDescriptor(window.navigator, "maxTouchPoints"),
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const [prop, descriptor] of Object.entries(originalNavigatorDescriptors)) {
    if (descriptor) Object.defineProperty(window.navigator, prop, descriptor);
    else delete window.navigator[prop];
  }
});

describe("isIOS", () => {
  it("returns true for an iPhone user agent", () => {
    mockUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(isIOS()).toBe(true);
  });

  it("returns true for an iPad user agent", () => {
    mockUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)");
    expect(isIOS()).toBe(true);
  });

  it("returns true for iPadOS spoofing as a touch Mac", () => {
    mockUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5);
    expect(isIOS()).toBe(true);
  });

  it("returns false for a generic desktop user agent", () => {
    mockUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Win32", 0);
    expect(isIOS()).toBe(false);
  });

  it("returns false for Android", () => {
    mockUserAgent("Mozilla/5.0 (Linux; Android 14)", "Linux armv8l", 5);
    expect(isIOS()).toBe(false);
  });
});

describe("installIosRoot", () => {
  it("replaces the current history entry with a tagged root state at seq 0", () => {
    const replaceSpy = vi.spyOn(window.history, "replaceState");

    installIosRoot("home");

    expect(replaceSpy).toHaveBeenCalledWith(
      { mirocardIosNav: true, screen: "home", seq: 0 },
      "",
      window.location.href.replace(/#.*$/, ""),
    );
  });

  it("resets the sequence counter so the next push starts at 1", () => {
    installIosRoot("home");
    const pushSpy = vi.spyOn(window.history, "pushState");

    pushIosScreen("students");

    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ seq: 1 }),
      "",
      expect.any(String),
    );
  });
});

describe("pushIosScreen", () => {
  it("pushes a tagged state with an incrementing sequence and a unique URL each time", () => {
    installIosRoot("home");
    const pushSpy = vi.spyOn(window.history, "pushState");

    pushIosScreen("students");
    const firstUrl = pushSpy.mock.calls[0][2];
    expect(pushSpy.mock.calls[0][0]).toEqual({ mirocardIosNav: true, screen: "students", seq: 1 });

    pushIosScreen("student_edit");
    const secondUrl = pushSpy.mock.calls[1][2];
    expect(pushSpy.mock.calls[1][0]).toEqual({ mirocardIosNav: true, screen: "student_edit", seq: 2 });

    expect(secondUrl).not.toBe(firstUrl);
  });
});

describe("getIosNavState", () => {
  it("returns the state when it is tagged", () => {
    const event = { state: { mirocardIosNav: true, screen: "home", seq: 3 } };
    expect(getIosNavState(event)).toEqual({ mirocardIosNav: true, screen: "home", seq: 3 });
  });

  it("returns null when state is missing", () => {
    expect(getIosNavState({ state: null })).toBeNull();
  });

  it("returns null when state is not tagged (foreign entry, e.g. below our root)", () => {
    expect(getIosNavState({ state: { someOtherApp: true } })).toBeNull();
  });
});
