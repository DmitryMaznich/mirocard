import { describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { ModePickerPreviewRow } from "./ModePickerPreview";

function render(props) {
  const div = document.createElement("div");
  act(() => createRoot(div).render(createElement(ModePickerPreviewRow, { topicId: "t", index: 0, onSelect() {}, onInfo() {}, ...props })));
  return div;
}

describe("ModePickerPreviewRow numbers", () => {
  const mode = { id: "m", ui: { icon: "media/icons/reading_mode.svg" } };
  it("a numbered topic shows the title's own number instead of the icon", () => {
    const div = render({ mode, title: "3. Лото", numbered: true });
    expect(div.querySelector(".topic-ui-exercise-number")?.textContent).toBe("3");
    expect(div.querySelector("strong").textContent).toBe("Лото");
  });
  it("other topics keep the icon", () => {
    const div = render({ mode, title: "3. Лото" });
    expect(div.querySelector(".topic-ui-exercise-number")).toBeNull();
  });
});
