import { describe, it, expect, vi } from "vitest";
import PlaceValueRenderer from "./index.jsx";
import { coinHarness } from "./coinTestHelpers.jsx";

const task = { type: "build_number", cardId: "b", conceptId: "b", number: 47, target: { tens: 4, ones: 7 }, prompt: "digits", supportMode: "learning" };

describe("PlaceValueRenderer", () => {
  const h = coinHarness();

  it("with strict stars a wrong check costs the streak via onStreakReset, keeping the half-built model", () => {
    const onStreakReset = vi.fn(), onMistake = vi.fn();
    const Wrapped = (props) => <PlaceValueRenderer {...props} sessionParams={{ strictStars: true }} onStreakReset={onStreakReset} onMistake={onMistake} />;
    h.mount(Wrapped, task);
    h.click("Взять стопку"); h.click("Проверить");
    expect(onStreakReset).toHaveBeenCalledWith("b", "b");
    expect(onMistake).not.toHaveBeenCalled();
    expect(h.container.querySelectorAll(".px-zone--tens .cb-ten-stack")).toHaveLength(1);
  });

  it("without strict stars mistakes aren't reported at all", () => {
    const onStreakReset = vi.fn();
    const Wrapped = (props) => <PlaceValueRenderer {...props} sessionParams={{}} onStreakReset={onStreakReset} />;
    h.mount(Wrapped, task);
    h.click("Взять стопку"); h.click("Проверить");
    expect(onStreakReset).not.toHaveBeenCalled();
  });
});
