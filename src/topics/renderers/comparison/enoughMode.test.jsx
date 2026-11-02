import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { generateTasks, ENOUGH_SETS } from "./engine.js";
import CompareEnough from "./CompareEnough.jsx";

const MODE = { id: "compare_enough", type: "compare_enough", defaultCardId: "compare_easy" };
const cards = [{ id: "compare_easy", conceptId: "compare_easy" }];

describe("Сравнение — «Всем хватает?»: задания", () => {
  it("outcomes come evenly — not enough, exactly enough, spare — and every set shows up", () => {
    const tasks = generateTasks(MODE, cards, 60);
    const lack = tasks.filter((t) => t.things < t.who).length;
    const equal = tasks.filter((t) => t.things === t.who).length;
    const spare = tasks.filter((t) => t.things > t.who).length;
    expect([lack, equal, spare]).toEqual([20, 20, 20]);
    expect(new Set(tasks.map((t) => t.set))).toEqual(new Set(ENOUGH_SETS.map((s) => s.id)));
    tasks.forEach((t) => {
      expect(t.who).toBeGreaterThanOrEqual(3);
      expect(t.who).toBeLessThanOrEqual(6);
      expect(Math.abs(t.things - t.who)).toBeLessThanOrEqual(2);
      expect(t.whoSprites).toHaveLength(t.who);
      expect(t.order).toBe("check");
    });
  });

  it("the sentence names who is short or what is spare, in the right case and gender", () => {
    const tasks = generateTasks(MODE, cards, 300);
    const find = (set, diff) => tasks.find((t) => t.set === set && t.things - t.who === diff)?.verdictText;
    expect(find("chairs", -1)).toBe("Стульев не хватает. Одному не хватает стула.");
    expect(find("chairs", -2)).toBe("Стульев не хватает. Двоим не хватает стульев.");
    expect(find("cups", 1)).toBe("Блюдец хватает всем. Одно блюдце лишнее.");
    expect(find("dogs", 2)).toBe("Косточек хватает всем. Две косточки лишние.");
    expect(find("rabbits", 0)).toBe("Морковок хватает всем: кроликов и морковок поровну.");
    expect(tasks.find((t) => t.set === "cars").instruction).toBe("Всем машинкам хватает гаражей?");
  });

  it("«Сначала ответить» is carried on every task", () => {
    expect(generateTasks(MODE, cards, 6, { enoughOrder: "answer" }).every((t) => t.order === "answer")).toBe(true);
  });
});

describe("Сравнение — «Всем хватает?»: экран", () => {
  let container, root;
  afterEach(() => { act(() => root?.unmount()); container?.remove(); });

  const base = {
    type: "compare_enough", conceptId: "compare_easy", set: "chairs", who: 3, things: 2, enough: false,
    whoSprites: ["media/enough/kid_1.webp", "media/enough/kid_2.webp", "media/enough/kid_3.webp"],
    thingSprite: "media/enough/chair.webp", place: ENOUGH_SETS[0].place,
    instruction: "Всем хватает стульев?", tapHint: "Нажимай на стулья", verdictText: "Стульев не хватает. Одному не хватает стула.",
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

  it("matching: each tap seats the next one; when the chairs run out, the last child lights up and the task counts once", async () => {
    const calls = await mount({ ...base, order: "check" });
    act(() => things()[1].click());
    expect(container.querySelectorAll(".enough-placed")).toHaveLength(1);
    expect(calls.correct).toBe(0);
    act(() => things()[0].click());
    expect(container.querySelectorAll(".enough-placed")).toHaveLength(2);
    expect(calls.correct).toBe(1);
    const who = [...container.querySelectorAll(".enough-who")];
    expect(who.map((w) => w.classList.contains("enough-who--without"))).toEqual([false, false, true]);
    expect(container.querySelector(".compare-verdict").textContent).toBe(base.verdictText);
  });

  it("spare objects light up when everyone already has one", async () => {
    await mount({ ...base, who: 2, things: 3, enough: true, whoSprites: base.whoSprites.slice(0, 2), order: "check" });
    act(() => things()[0].click());
    act(() => things()[2].click());
    expect(things().map((t) => t.classList.contains("enough-thing--spare"))).toEqual([false, true, false]);
  });

  it("«Сначала ответить»: objects wait for the guess; a wrong guess is a mistake but the task still finishes", async () => {
    const calls = await mount({ ...base, order: "answer" });
    expect(things().every((t) => t.disabled)).toBe(true);
    const yes = [...container.querySelectorAll(".cfn-btn")].find((b) => b.textContent === "Хватает");
    act(() => yes.click());
    expect(calls.mistake).toBe(1);
    expect(things().some((t) => !t.disabled)).toBe(true);
    act(() => things()[0].click());
    act(() => things()[1].click());
    expect(calls.correct).toBe(1);
  });
});
