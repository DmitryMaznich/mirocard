import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import InstallBanner from "./InstallBanner.jsx";

vi.mock("@/shared/components/Modal", () => ({
  default: ({ title, children, onClose }) => (
    <section role="dialog"><h2>{title}</h2>{children}<button onClick={onClose}>Закрыть инструкцию</button></section>
  ),
}));
vi.mock("@/shared/components/Button", () => ({ default: ({ children, ...props }) => <button {...props}>{children}</button> }));

let root;
let container;
afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function renderBanner(userAgent) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<InstallBanner />));
}

it("opens and closes the Firefox-specific guide instead of silently invoking an unavailable install prompt", () => {
  renderBanner("Mozilla/5.0 (Android 15; Mobile; rv:147.0) Gecko/147.0 Firefox/147.0");
  const installButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Установить");
  expect(installButton).toBeTruthy();
  act(() => installButton.click());
  const dialog = container.querySelector('[role="dialog"]');
  expect(dialog.textContent).toContain("Установка через Firefox");
  expect(dialog.textContent).toContain("без адресной строки");
  expect(dialog.textContent).not.toContain("Safari");
  act(() => Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent === "Закрыть инструкцию").click());
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

it("preserves Chromium's native install confirmation", async () => {
  renderBanner("Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36");
  expect(container.textContent).toBe("");
  const prompt = vi.fn();
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
  act(() => window.dispatchEvent(event));
  const button = Array.from(container.querySelectorAll("button")).find((entry) => entry.textContent === "Установить");
  await act(async () => button.click());
  expect(prompt).toHaveBeenCalledOnce();
  expect(container.textContent).toBe("");
});
