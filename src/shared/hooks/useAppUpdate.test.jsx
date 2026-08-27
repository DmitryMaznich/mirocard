import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { _internals, useAppUpdate } from "./useAppUpdate";

// Mirrors CURRENT_VERSION's own computation in useAppUpdate.js so the
// "no mismatch" baseline tests are correct regardless of what __APP_VERSION__
// happens to resolve to under vitest's own build of this module.
const CURRENT_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

vi.mock("@/core/api", () => ({
  api: { get: vi.fn() },
}));

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
let reloadSpy = null;

function Host() {
  latest = useAppUpdate();
  return null;
}

function setHidden(hidden) {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
}

function mountWithRegistration(reg) {
  navigator.serviceWorker = {
    ready: Promise.resolve(reg),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  root = createRoot(container);
  return act(async () => {
    root.render(<Host />);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  latest = null;
  setHidden(false);
  container = document.createElement("div");
  document.body.appendChild(container);
  api.get.mockReset().mockResolvedValue({ version: CURRENT_VERSION });
  reloadSpy = vi.fn();
  _internals.reload = reloadSpy;
  useAppStore.setState({ screen: "home" });
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
    await mountWithRegistration(reg);

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
    await mountWithRegistration(reg);
    expect(reg.update).toHaveBeenCalledTimes(1);

    setHidden(true);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(reg.update).toHaveBeenCalledTimes(1);
  });

  it("reloads when the server reports a different version than this bundle, outside a session", async () => {
    api.get.mockResolvedValue({ version: "1.0.9999" });
    const reg = makeFakeRegistration();
    useAppStore.setState({ screen: "home" });

    await mountWithRegistration(reg);

    expect(api.get).toHaveBeenCalledWith("/version");
    expect(latest.hasUpdate).toBe(true);
    expect(reloadSpy).toHaveBeenCalled();
  });

  it("flags an update but does not reload while an exercise session is active", async () => {
    api.get.mockResolvedValue({ version: "1.0.9999" });
    const reg = makeFakeRegistration();
    useAppStore.setState({ screen: "session" });

    await mountWithRegistration(reg);

    expect(latest.hasUpdate).toBe(true);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("re-checks the server version on every visibility resume, catching drift the registration missed", async () => {
    const reg = makeFakeRegistration();
    await mountWithRegistration(reg);
    expect(latest.hasUpdate).toBe(false);

    // registration.waiting never fires (simulates the drift this hook now
    // guards against — e.g. a frozen tab that missed controllerchange), but
    // the server directly reports a newer build.
    api.get.mockResolvedValue({ version: "1.0.9999" });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(latest.hasUpdate).toBe(true);
    expect(reloadSpy).toHaveBeenCalled();
  });

  it("ignores an 'unknown' server version rather than treating it as a mismatch", async () => {
    api.get.mockResolvedValue({ version: "unknown" });
    const reg = makeFakeRegistration();

    await mountWithRegistration(reg);

    expect(latest.hasUpdate).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
