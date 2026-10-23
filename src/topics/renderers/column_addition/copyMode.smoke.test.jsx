import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import ColumnAdditionRenderer from "./index.jsx";

Element.prototype.scrollIntoView ??= () => {};

vi.mock("@/shared/components/RewardVideoModal", () => ({ default: ({ onDismiss }) => <button type="button" onClick={onDismiss}>reward</button> }));

describe("«Контрольная работа» (column_copy)", () => {
  let container = null;
  let root = null;
  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    root = null; container = null;
  });

  const params = { count: 6, operation: "mixed", carryMode: "mixed", kind_22: true, kind_33: true, kind_newplace: true };
  const rows = () => Array.from(container.querySelectorAll(".col-copy-expr-row"));
  const press = (label) => {
    const b = Array.from(container.querySelectorAll("button")).find((x) => x.getAttribute("aria-label") === label || x.textContent === label);
    act(() => b.click());
  };
  const answerOf = (row) => {
    const [, a, sign, b] = row.textContent.match(/^(\d+)([+−])(\d+)=/);
    return sign === "+" ? Number(a) + Number(b) : Number(a) - Number(b);
  };

  it("one answer each, no answer cells ahead; the adult's result lists the mistakes", () => {
    const onCorrect = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ColumnAdditionRenderer mode={{ type: "column_copy" }} sessionParams={params} onCorrect={onCorrect} student={{}} />));
    expect(rows()).toHaveLength(6);
    // Only one empty cell — nothing tells how long the answer is.
    expect(container.querySelectorAll(".col-copy-cell-input")).toHaveLength(1);
    expect(container.querySelector('button[aria-label="Проверить"]').disabled).toBe(true);
    const answers = rows().map(answerOf);
    answers.forEach((right, i) => {
      for (const d of String(i === 2 ? right + 1 : right)) press(d);
      press("Проверить");
    });
    expect(container.querySelectorAll(".col-copy-cell-wrong").length).toBe(String(answers[2] + 1).length);
    expect(container.querySelector(".col-copy-result-total").textContent).toBe("Верно 5 из 6");
    expect(container.querySelectorAll(".col-copy-result-mistake")).toHaveLength(1);
    expect(container.querySelector(".col-copy-result-mistake b").textContent).toBe(String(answers[2]));
    press("Готово");
    press("reward");
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });
});
