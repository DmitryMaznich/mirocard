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
    const tasks = generateTasks(MODE, cards, 120, { enough: "check" });
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
      expect(t.order).toBe("check");
    });
  });

  it("the question, the sentence (no «поровну») and the adult's «почему», in the right case and gender", () => {
    const ec = enoughCards(600, { enough: "answer" });
    const find = (set, diff) => ec.find((t) => t.set === set && t.things - t.who === diff);
    const c = find("chairs", -1);
    expect(c.enoughQuestion).toBe("Всем детям хватает стульев?");
    expect(c.verdictText).toBe("Стульев не хватает. Одному не хватает стула.");
    expect(c.whyText).toBe("Спросите: почему не хватает? — Потому что детей больше, чем стульев.");
    expect(find("chairs", -2).verdictText).toBe("Стульев не хватает. Двоим не хватает стульев.");
    expect(find("cups", 1).verdictText).toBe("Блюдец хватает всем. Одно блюдце лишнее.");
    expect(find("cups", 1).whyText).toBe("Спросите: почему хватает? — Потому что блюдец больше, чем чашек.");
    expect(find("dogs", 2).verdictText).toBe("Косточек хватает всем. Две косточки лишние.");
    expect(find("rabbits", 0).verdictText).toBe("Морковок хватает всем: каждому кролику по морковке.");
    expect(find("rabbits", 0).whyText).toBe("Спросите: почему хватает? — Потому что сколько кроликов, столько и морковок.");
    expect(ec.some((t) => /поровну/i.test(t.verdictText + t.whyText))).toBe(false);
    expect(find("cars", 0).enoughQuestion).toBe("Всем машинкам хватает гаражей?");
    expect(ec.every((t) => t.order === "answer")).toBe(true);
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
    verdictText: "Стульев не хватает. Одному не хватает стула.",
    whyText: "Спросите: почему не хватает? — Потому что детей больше, чем стульев.",
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

  it("«Сначала проверить»: match, then «всем хватает»; a wrong answer shakes, is a mistake, and is answered again", async () => {
    const calls = await mount({ ...base, order: "check" });
    expect(heading()).toBe("Дай каждому ребёнку стул");
    expect(container.querySelector(".cfn-btn")).toBeNull();
    act(() => things()[1].click());
    act(() => things()[0].click());
    const who = [...container.querySelectorAll(".enough-who")];
    expect(who.map((w) => w.classList.contains("enough-who--without"))).toEqual([false, false, true]);
    await wait(500);
    expect(heading()).toBe("Всем детям хватает стульев?");
    expect(button("Поровну")).toBeUndefined();
    act(() => button("Хватает").click());
    expect(calls.mistake).toBe(1);
    expect(calls.correct).toBe(0);
    act(() => button("Не хватает").click());
    await wait(400);
    expect(calls.correct).toBe(1);
    expect(container.querySelector(".compare-verdict").textContent).toBe(base.verdictText);
    expect(container.querySelector(".enough-why").textContent).toBe(base.whyText);
  });

  it("«Сначала ответить»: the answer first by eye, a wrong one is kept and counted, then the matching", async () => {
    const calls = await mount({ ...base, order: "answer" });
    expect(heading()).toBe("Всем детям хватает стульев?");
    expect(things().every((t) => t.disabled)).toBe(true);
    act(() => button("Хватает").click());
    expect(calls.mistake).toBe(1);
    expect(button("Хватает").className).toContain("cfn-btn--wrong-kept");
    await wait(700);
    expect(heading()).toBe("Дай каждому ребёнку стул");
    act(() => things()[0].click());
    act(() => things()[1].click());
    await wait(500);
    expect(calls).toEqual({ correct: 1, mistake: 1 });
  });

  it("cups move onto the saucers (what the action names moves); a cup without one stays alone on top", async () => {
    const cups = { ...base, set: "cups", mover: "who", place: ENOUGH_SETS.find((x) => x.id === "cups").place,
      whoSprites: ["media/enough/cup_1.webp", "media/enough/cup_2.webp", "media/enough/cup_3.webp"], thingSprite: "media/enough/saucer.webp",
      matchHint: "Поставь каждую чашку на блюдце", order: "check" };
    await mount(cups);
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
    await mount({ ...base, who: 2, things: 3, enough: true, whoSprites: base.whoSprites.slice(0, 2), order: "check" });
    act(() => things()[0].click());
    act(() => things()[2].click());
    expect(things().map((t) => t.classList.contains("enough-thing--spare"))).toEqual([false, true, false]);
  });
});
