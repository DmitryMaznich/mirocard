import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useKioskMode } from "./useKioskMode";

let root = null;
let container = null;
let orientation = null;

function KioskHost({ orientationLock = null }) {
  useKioskMode(orientationLock);
  return null;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  orientation = {
    lock: vi.fn(() => Promise.resolve()),
    unlock: vi.fn(),
  };
  Object.defineProperty(window.screen, "orientation", {
    configurable: true,
    value: orientation,
  });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
  vi.restoreAllMocks();
});

describe("useKioskMode orientation", () => {
  it("unlocks orientation by default", async () => {
    await act(async () => {
      root.render(<KioskHost />);
    });

    expect(orientation.unlock).toHaveBeenCalledTimes(1);
    expect(orientation.lock).not.toHaveBeenCalled();
  });

  it("locks only when an explicit orientation is requested", async () => {
    await act(async () => {
      root.render(<KioskHost orientationLock="landscape" />);
    });

    expect(orientation.lock).toHaveBeenCalledWith("landscape");
    expect(orientation.unlock).not.toHaveBeenCalled();
  });
});
