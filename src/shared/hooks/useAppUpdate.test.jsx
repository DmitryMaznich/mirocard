import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppUpdate } from "./useAppUpdate";

// A fake ServiceWorkerRegistration: just enough surface (waiting, update(),
// updatefound listener) for the hook under test.
function makeFakeRegistration() {
  return {
    waiting: null,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

let root = null;
let container = null;
let latest = null;

function Host() {
  latest = useAppUpdate();
  return null;
}

function setHidden(hidden) {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
}

beforeEach(() => {
  latest = null;
  setHidden(false);
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (root) act(() => root.unmount());
  if (container) container.remove();
  root = null; container = null;
  delete navigator.serviceWorker;
  vi.clearAllMocks();
});

describe("useAppUpdate", () => {
  it("re-checks for an update when the tab becomes visible again, not just on mount", async () => {
    const reg = makeFakeRegistration();
    const controllerListeners = [];
    navigator.serviceWorker = {
      ready: Promise.resolve(reg),
      addEventListener: (type, fn) => { if (type === "controllerchange") controllerListeners.push(fn); },
      removeEventListener: vi.fn(),
    };

    root = createRoot(container);
    await act(async () => {
      root.render(<Host />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(reg.update).toHaveBeenCalledTimes(1);
    expect(latest.hasUpdate).toBe(false);

    // A newer version installs while the app is backgrounded — the tab is
    // merely resumed (not reloaded), so nothing has re-checked yet.
    reg.waiting = { postMessage: vi.fn() };

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(reg.update).toHaveBeenCalledTimes(2);
    expect(latest.hasUpdate).toBe(true);
  });

  it("does not re-check while the tab is still hidden", async () => {
    const reg = makeFakeRegistration();
    navigator.serviceWorker = {
      ready: Promise.resolve(reg),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    root = createRoot(container);
    await act(async () => {
      root.render(<Host />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(reg.update).toHaveBeenCalledTimes(1);

    setHidden(true);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(reg.update).toHaveBeenCalledTimes(1);
  });
});
