import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import DictationReview from "./DictationReview.jsx";

// The mark is only a choice until «Оценить»: a digit and a sign in any order, changeable; nothing is written before (owner, 2026-10-29).
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const Answers = ({ grade }) => <div data-testid="sheet">{grade ? `${grade.n}${grade.sign}` : "—"}</div>;
const key = (t) => [...host.querySelectorAll(".propis2-grade-btn")].find((b) => b.textContent === t);
const click = (el) => act(() => el.click());

describe("propis2 dictation review: the mark", () => {
  it("5, then −: «Оценить: 5−»; the choice changes freely; only «Оценить» writes it", () => {
    act(() => root.render(<DictationReview task={{ items: [{ display: "дом" }], level: "words" }} onClose={() => {}} Answers={Answers} />));
    const rate = () => host.querySelector(".p2r-rate");
    expect(rate().disabled).toBe(true);
    click(key("5"));
    click(key("−"));
    expect(host.querySelector("[data-testid=sheet]").textContent).toBe("—"); // nothing written yet
    expect(rate().textContent).toBe("Оценить: 5−");
    click(key("4")); // changed mind: the sign stays
    click(key("−")); // and released
    expect(rate().textContent).toBe("Оценить: 4");
    click(key("+"));
    click(rate());
    expect(host.querySelector("[data-testid=sheet]").textContent).toBe("4+");
    expect(host.querySelector(".p2r-graded b").textContent).toBe("4+");
  });
});
