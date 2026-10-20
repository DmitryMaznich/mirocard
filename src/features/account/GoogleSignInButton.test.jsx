import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import GoogleSignInButton from "./GoogleSignInButton.jsx";

describe("GoogleSignInButton", () => {
  let container = null, root = null;
  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    document.querySelectorAll("script[src*='accounts.google.com/gsi']").forEach((s) => s.remove());
    delete window.google;
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

  it("passes the selected locale to an already loaded SDK and refreshes it", async () => {
    const renderButton = vi.fn();
    window.google = { accounts: { id: { initialize: vi.fn(), renderButton } } };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<GoogleSignInButton clientId="cid" locale="sl" />));
    expect(renderButton.mock.calls.at(-1)[1].locale).toBe("sl");
    await act(async () => root.render(<GoogleSignInButton clientId="cid" locale="ru" />));
    expect(renderButton.mock.calls.at(-1)[1].locale).toBe("ru");
  });
});
