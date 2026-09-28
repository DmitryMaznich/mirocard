// The in-app privacy text (shown in the signup modal) must say exactly what the
// published policy says (backend/legal/privacy.html → /api/privacy). They had
// drifted apart once (old payment providers, missing purchase retention).
import { act } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { describe, it, expect } from "vitest";
import PrivacyContent from "./PrivacyContent.jsx";

const normalize = (s) => s
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

function publishedText() {
  const html = readFileSync(path.resolve(process.cwd(), "backend/legal/privacy.html"), "utf8");
  return normalize(html.replace(/<h1>[\s\S]*?<\/h1>/, "").replace(/<[^>]+>/g, " "));
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("PrivacyContent", () => {
  it("matches the published Russian privacy policy word for word", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => { root.render(<PrivacyContent />); });
    const inApp = normalize(container.innerHTML.replace(/<[^>]+>/g, " "));
    act(() => root.unmount());
    expect(inApp).toBe(publishedText());
  });
});
