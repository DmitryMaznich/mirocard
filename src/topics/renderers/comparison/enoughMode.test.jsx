import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { generateTasks, ENOUGH_SETS } from "./engine.js";
import CompareEnough from "./CompareEnough.jsx";

const MODE = { id: "compare_real_life", type: "compare_real_life", defaultCardId: "compare_medium" };
const cards = [{ id: "compare_medium", conceptId: "compare_medium" }];
const enoughCards = (n, params) => generateTasks(MODE, cards, n, params).filter((t) => t.type === "compare_enough");

describe("Сравнение — «Сравни в жизни», опция «Всем хватает?»: задания", () => {
  it("off by default: only picture scenes", () => {
    expect(enoughCards(20)).toHaveLength(0);
  });

  it("on: the cards go in turn with the scenes, outcomes even, every set shows up", () => {
    const tasks = generateTasks(MODE, cards, 120, { enough: "on" });
    expect(tasks.filter((_, i) => i % 2 === 0).every((t) => t.type === "compare_real_life")).toBe(true);
    const ec = tasks.filter((t) => t.type === "compare_enough");
    expect(ec).toHaveLength(60);
    expect(ec.filter((t) => t.things < t.who)).toHaveLength(20);
    expect(ec.filter((t) => t.things === t.who)).toHaveLength(20);
    expect(ec.filter((t) => t.things > t.who)).toHaveLength(20);
    expect(new Set(ec.map((t) => t.set))).toEqual(new Set(ENOUGH_SETS.map((s) => s.id)));
    ec.forEach((t) => {
      expect(t.who).toBeGreaterThanOrEqual(3);
      expect(t.who).toBeLessThanOrEqual(6);
    });
  });

  it("«почему»: five comparisons, two right ones on an unequal card, «сколько …, столько и …» on every card", () => {
    const ec = enoughCards(600, { enough: "answer" }); // an old saved value: still on
    const find = (set, diff) => ec.find((t) => t.set === set && t.things - t.who === diff);
    const c = find("chairs", -1);
    expect(c.enoughQuestion).toBe("Всем детям хватает стульев?");
    expect(c.whyQuestion).toBe("Почему стульев не хватает?");
    expect(c.whyOptions.map((o) => o.label)).toEqual(["детей больше", "стульев больше", "детей меньше", "стульев меньше", "сколько детей, столько и стульев"]);
    expect(c.whyRight).toEqual(["whoMore", "thingLess"]);
    expect(find("cups", 1).whyQuestion).toBe("Почему блюдец хватает?");
    expect(find("cups", 1).whyRight).toEqual(["thingMore", "whoLess"]);
    expect(find("rabbits", 0).whyRight).toEqual(["same"]);
    expect(find("rabbits", 0).whyOptions[4].label).toBe("сколько кроликов, столько и морковок");
    expect(ec.every((t) => t.whyOptions.some((o) => o.id === "same"))).toBe(true);
    expect(ec.some((t) => /поровну/i.test(t.whyOptions.map((o) => o.label).join(" ")))).toBe(false);
    expect(find("cars", 0).enoughQuestion).toBe("Всем машинкам хватает гаражей?");
  });
});

describe("Сравнение — «Всем хватает?»: экран", () => {
  let container, root;
  afterEach(() => { act(() => root?.unmount()); container?.remove(); });

  const base = {
    type: "compare_enough", conceptId: "compare_medium", set: "chairs", who: 3, things: 2, enough: false,
    whoSprites: ["media/enough/kid_1.webp", "media/enough/kid_2.webp", "media/enough/kid_3.webp"],
    thingSprite: "media/enough/chair.webp", place: ENOUGH_SETS[0].place,
    enoughQuestion: "Всем детям хватает стульев?", matchHint: "Дай каждому ребёнку стул",
    whyQuestion: "Почему стульев не хватает?", whyRight: ["whoMore", "thingLess"],
    whyOptions: [{ id: "whoMore", label: "детей больше" }, { id: "thingMore", label: "стульев больше" }, { id: "whoLess", label: "детей меньше" },
      { id: "thingLess", label: "стульев меньше" }, { id: "same", label: "сколько детей, столько и стульев" }],
  };
  async function mount(task) {
    const calls = { correct: 0, mistake: 0 };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<CompareEnough task={task} topicId="comparison" loadTopicFileUrl={async (_, p) => `/${p}`}
      onCorrect={() => calls.correct++} onMistake={() => calls.mistake++} onAdvance={() => {}} />));
    return calls;
  }
  const things = () => [...container.querySelectorAll(".enough-thing")];
  const heading = () => container.querySelector(".compare-instruction").textContent;
  const button = (label) => [...container.querySelectorAll(".cfn-btn")].find((b) => b.textContent === label);
  const wait = (ms) => act(() => new Promise((r) => setTimeout(r, ms)));

  it("right by eye: no matching, straight to «почему?»; a wrong «почему» shakes and is answered again", async () => {
    const calls = await mount(base);
    expect(heading()).toBe("Всем детям хватает стульев?");
    expect(things().every((t) => t.disabled)).toBe(true); // nothing to drag before a mistake
    act(() => button("Не хватает").click());
    await wait(400);
    expect(heading()).toBe("Почему стульев не хватает?");
    expect(container.querySelectorAll(".enough-placed")).toHaveLength(0);
    expect(container.querySelector(".enough-because").textContent).toBe("Потому что…");
    act(() => button("стульев больше").click());
    expect(calls.mistake).toBe(1);
    act(() => button("стульев меньше").click()); // = «детей больше», counts too
    await wait(400);
    expect(calls).toEqual({ correct: 1, mistake: 1 });
    expect(container.querySelector("button button")).toBeNull();
    expect([...container.querySelectorAll(".enough-why-grid .cfn-btn--correct")].map((b) => b.textContent)).toEqual(["стульев меньше"]);
    expect(container.querySelector(".enough-because").textContent).toBe("Потому что стульев меньше.");
  });

  it("wrong by eye: the guess stays marked, «Проверь: …» matching, the question again, then «почему?»", async () => {
    const calls = await mount(base);
    act(() => button("Хватает").click());
    expect(calls.mistake).toBe(1);
    expect(button("Хватает").className).toContain("cfn-btn--wrong-kept");
    await wait(700);
    expect(heading()).toBe("Проверь: дай каждому ребёнку стул");
    act(() => things()[1].click());
    act(() => things()[0].click());
    const who = [...container.querySelectorAll(".enough-who")];
    expect(who.map((w) => w.classList.contains("enough-who--without"))).toEqual([false, false, true]);
    await wait(500);
    expect(heading()).toBe("Всем детям хватает стульев?");
    expect(button("Хватает").className).not.toContain("wrong");
    act(() => button("Не хватает").click());
    await wait(400);
    expect(heading()).toBe("Почему стульев не хватает?");
    act(() => button("детей больше").click());
    await wait(400);
    expect(calls).toEqual({ correct: 1, mistake: 1 });
  });

  it("cups move onto the saucers (what the action names moves); a cup without one stays alone on top", async () => {
    const cups = { ...base, set: "cups", mover: "who", place: ENOUGH_SETS.find((x) => x.id === "cups").place,
      whoSprites: ["media/enough/cup_1.webp", "media/enough/cup_2.webp", "media/enough/cup_3.webp"], thingSprite: "media/enough/saucer.webp",
      matchHint: "Поставь каждую чашку на блюдце" };
    await mount(cups);
    act(() => button("Хватает").click()); // wrong → the check
    await wait(700);
    const cupButtons = () => [...container.querySelectorAll("button.enough-who")];
    expect(cupButtons()).toHaveLength(3);
    expect(container.querySelectorAll("button.enough-thing")).toHaveLength(0); // saucers stay put
    act(() => cupButtons()[2].click());
    act(() => cupButtons()[0].click());
    expect(cupButtons().map((b) => b.style.visibility)).toEqual(["hidden", "visible", "hidden"]);
    const onSaucers = [...container.querySelectorAll(".enough-thing--target .enough-placed")].map((img) => img.getAttribute("src"));
    expect(onSaucers).toEqual(["/media/enough/cup_3.webp", "/media/enough/cup_1.webp"]);
    expect(cupButtons()[1].classList.contains("enough-who--without")).toBe(true);
  });

  it("spare objects light up when everyone already has one", async () => {
    await mount({ ...base, who: 2, things: 3, enough: true, whoSprites: base.whoSprites.slice(0, 2) });
    act(() => button("Не хватает").click()); // wrong → the check
    await wait(700);
    act(() => things()[0].click());
    act(() => things()[2].click());
    expect(things().map((t) => t.classList.contains("enough-thing--spare"))).toEqual([false, true, false]);
  });
});
