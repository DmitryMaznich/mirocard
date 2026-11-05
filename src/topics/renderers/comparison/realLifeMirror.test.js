import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine.js";

const MODE = { id: "compare_real_life", type: "compare_real_life", defaultCardId: "compare_medium" };
const cards = [{ id: "compare_medium", conceptId: "compare_medium" }];

describe("Сравнение — «Сравни в жизни»: зеркало и ступеньки фразы", () => {
  it("about half of the showings are mirrored, and a mirrored one has its sides swapped", () => {
    const tasks = generateTasks(MODE, cards, 400);
    const mirrored = tasks.filter((t) => t.mirror);
    expect(mirrored.length).toBeGreaterThan(120);
    expect(mirrored.length).toBeLessThan(280);
    const petya = tasks.filter((t) => t.image.endsWith("apples_petya_masha.jpg"));
    const flipped = petya.find((t) => t.mirror), plain = petya.find((t) => !t.mirror);
    expect(plain).toMatchObject({ nameANom: "Петя", nameBNom: "Маша", left: 2, right: 7, correctAnswer: "b" });
    expect(flipped).toMatchObject({ nameANom: "Маша", nameBNom: "Петя", left: 7, right: 2, correctAnswer: "a", labelA: "У Маши" });
  });

  it("the verdict follows the chosen step: short, with the item, full (default)", () => {
    const pick = (phrase) => generateTasks(MODE, cards, 300, phrase ? { phrase } : {})
      .find((t) => t.image.endsWith("apples_petya_masha.jpg") && !t.mirror).verdictText;
    expect(pick()).toBe("У Маши больше яблок, чем у Пети.");
    expect(pick("short")).toBe("У Маши больше.");
    expect(pick("item")).toBe("У Маши больше яблок.");
  });

  it("equal scenes and «где» scenes have their own short forms", () => {
    const find = (phrase, img) => generateTasks(MODE, cards, 300, { phrase })
      .find((t) => t.image.endsWith(img) && !t.mirror).verdictText;
    expect(find("short", "apples_kirill_alisa.jpg")).toBe("Поровну.");
    expect(find("item", "apples_kirill_alisa.jpg")).toBe("Яблок поровну.");
    expect(find("item", "water_bogdan_marina.jpg")).toBe("Воды в стакане поровну.");
    expect(find("short", "stairs_small_tall.jpg")).toBe("На большой лестнице больше.");
    expect(find("item", "stairs_small_tall.jpg")).toBe("На большой лестнице больше ступенек.");
  });
});
