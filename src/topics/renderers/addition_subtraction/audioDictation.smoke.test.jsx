import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import Renderer from "./index.jsx";

vi.mock("./useAudioSequence", () => ({ useAudioSequence: () => ({ isPlaying: false, play: () => {} }) }));

let root, host;
afterEach(() => { act(() => root.unmount()); host.remove(); });
function mount(result) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  const task = { type: "operation_audio", cardId: "operation_plus", conceptId: "plus", operation: "add", sign: "+", start: result - 1, delta: 1, result, maxNumber: 99 };
  act(() => root.render(<Renderer task={task} onCorrect={() => {}} onIncorrect={() => {}} />));
}
const cells = () => [...host.querySelectorAll(".aod-cell")].map((c) => c.textContent);
const key = (d) => act(() => [...host.querySelectorAll(".aod-key")].find((b) => b.textContent === String(d)).click());

it("digits go in left to right — the tens first, nothing jumps (80: 8, then 0)", () => {
  mount(80);
  key(8);
  expect(cells()).toEqual(["8", ""]);
  key(0);
  expect(cells()).toEqual(["8", "0"]);
});

it("a right one-digit answer stands in the units cell", () => {
  mount(7);
  key(7);
  expect(cells()).toEqual(["7", ""]);
  act(() => host.querySelector('[aria-label="Проверить"]').click());
  expect(cells()).toEqual(["", "7"]);
});
