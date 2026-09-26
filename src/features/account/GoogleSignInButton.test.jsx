import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import GoogleSignInButton from "./GoogleSignInButton.jsx";

describe("GoogleSignInButton", () => {
  let container = null, root = null;
  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    document.querySelectorAll("script[src*='accounts.google.com/gsi']").forEach((s) => s.remove());
  });

  it("loads Google's script in Russian regardless of the browser language", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<GoogleSignInButton clientId="cid" />); });
    const script = document.querySelector("script[src*='accounts.google.com/gsi/client']");
    expect(script).not.toBeNull();
    expect(new URL(script.src).searchParams.get("hl")).toBe("ru");
  });
});
