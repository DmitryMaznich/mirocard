import { describe, expect, it } from "vitest";
import { generateTasks } from "./engine";
import { buildWordOptions, buildWordQuestion, buildSeasonFormOptions, modelAnswer } from "./exerciseModel";
import { alignWordFormationMode } from "@/topics/wordFormationMethodology";
import { applyReleaseTopicCopy } from "@/topics/releaseTopicCopy";
import { transferCards } from "@/topics/wordFormationTransfer";
import JSZip from "jszip";
import { readFileSync } from "node:fs";

const foods = ["рыбный", "мясной", "грибной", "куриный", "луковый"].map((adj, i) => ({
  id: `food${i}`, category: "soup", adjPhrase: `${adj} суп`, nounPhrase: `суп из продукта ${i}`,
  questionText: "какой?", wrongForms: ["ошибочн��й суп", "рыбовый суп", "рыбяной суп"],
}));
const seasons = ["осенний", "зимний", "весенний", "летний"].map((adj, i) => ({
  id: `season${i}`, category: "seasons", contextPhrase: ["Наступила осень", "Наступила зима", "Наступила весна", "Наступило лето"][i],
  items: [{ id: `coat${i}`, adjPhrase: `${adj} плащ`, image: "coat.webp" }],
}));

describe("methodologically valid word choices", () => {
  it("uses the same adjective–noun order for single-word and full stored answers", () => {
    expect(modelAnswer({ nounPhrase: "Погода", adjPhrase: "дождливая" })).toBe("дождливая погода");
    expect(modelAnswer(foods[0])).toBe("рыбный суп");
  });
  it.each([2, 3, 4])("offers %i distinct real words with one target", count => {
    const options = buildWordOptions(foods[0], [...foods, foods[1]], count);
    expect(options).toHaveLength(count);
    expect(new Set(options.map(o => o.text)).size).toBe(count);
    expect(options.filter(o => o.isTarget)).toEqual([{ text: "рыбный", isTarget: true }]);
    expect(options.every(o => foods.some(c => c.adjPhrase.startsWith(o.text)))).toBe(true);
  });
  it("caps persisted oversized settings and ignores legacy nonword difficulty", () => {
    const tasks = generateTasks({ type: "pick_form" }, foods, 5, { difficulty: "hard", optionCount: 25 });
    expect(tasks.every(task => task.options.length === 2)).toBe(true);
    expect(tasks.flatMap(t => t.options).some(o => o.text.includes("\uFFFD") || o.text === "рыбовый")).toBe(false);
  });
  it("does not publish a one-choice exercise when distractors are unavailable", () => {
    expect(generateTasks({ type: "pick_form" }, [foods[0]], 1, {})).toEqual([]);
  });
  it("does not silently replace an empty selected category with unrelated material", () => {
    expect(generateTasks({ type: "pick_form" }, foods, 5, { category: ["missing"] })).toEqual([]);
    expect(generateTasks({ type: "pair_intro" }, foods, 5, { category: ["missing"] })).toEqual([]);
  });
  it("a single selected season still provides contrasting adjectives", () => {
    const tasks = generateTasks({ type: "pick_form" }, seasons, 5, { category: ["seasons"], optionCount: 4 });
    // Explicit source context, not a list of objects to classify by season.
    expect(tasks.every(t => t.type === "pick_form" && t.options.length === 4)).toBe(true);
    const selected = generateTasks({ type: "pick_form" }, [seasons[0], { ...seasons[1], category: "other" }], 5, { category: ["seasons"] });
    expect(selected).toHaveLength(1);
    expect(selected[0].options).toHaveLength(2);
    expect(buildWordQuestion(selected[0].card)).toBe("Наступила осень. Плащ");
  });
  it("retains the source phrase when pictures and the phrase hint are switched off", () => {
    expect(buildWordQuestion({ nounPhrase: "суп из рыбы", adjPhrase: "рыбный суп" }, { hintMode: "noun_only", showImage: false }))
      .toBe("Суп из рыбы");
  });
  it("retains weather context even with noun-only settings", () => {
    expect(buildWordQuestion({ nounPhrase: "Погода", adjPhrase: "дождливая", contextPhrase: "На улице дождь" }, { hintMode: "noun_only" }))
      .toBe("На улице дождь. Погода");
  });
});

describe("agreement and installed settings", () => {
  it("uses all four authored food forms with stable source concepts", () => {
    const card = { id: "myaso", category: "soup", noun: "мясо", nounPhrase: "суп из мяса", adjPhrase: "мясной суп" };
    const tasks = generateTasks({ type: "season_form_pick" }, [card], 4, { optionCount: 4 });
    const expected = ["мясной", "мясная", "мясное", "мясные"];
    expect(tasks).toHaveLength(4);
    expect(tasks.map(t => t.item.noun).sort()).toEqual(["суп", "котлета", "блюдо", "котлеты"].sort());
    for (const task of tasks) {
      expect(task.options.map(o => o.key).sort()).toEqual([...expected].sort());
      expect(task.options.filter(o => o.isTarget)).toHaveLength(1);
      expect(task.item.sourcePhrase).toContain("из мяса");
      expect(task.card.id).toBe("myaso");
    }
  });
  it.each(["осенний плащ", "летняя кепка", "зимнее небо", "весенние цветы"])("offers two contrasting forms for %s", phrase => {
    const options = buildSeasonFormOptions(phrase);
    expect(options).toHaveLength(2);
    expect(options.filter(o => o.isTarget)).toHaveLength(1);
  });
  it("limits agreement to selected seasonal categories", () => {
    expect(generateTasks({ type: "season_form_pick" }, seasons, 4, { category: ["missing"] })).toEqual([]);
  });
  it("migrates old mode schemas without mutating the source", () => {
    const original = { type: "pick_form", params: { difficulty: { default: "hard" }, hideOptionImages: {}, category: { default: ["seasons"] } } };
    const mode = alignWordFormationMode(original);
    expect(mode.params.difficulty).toBeUndefined();
    expect(mode.params.hideOptionImages).toBeUndefined();
    expect(mode.params.hintMode).toBeUndefined();
    expect(mode.params.showImage.default).toBe(true);
    expect(mode.params.optionCount.default).toBe(2);
    expect(mode.params.category.default).toEqual(["soup"]);
    expect(original.params.difficulty.default).toBe("hard");
  });
  it("updates the schema through the normal installed-topic read path", () => {
    const record = applyReleaseTopicCopy({ meta: { id: "word_formation_soup" }, modes: [
      { id: "pick_form", type: "pick_form", params: { difficulty: { default: "hard" } } },
    ] });
    expect(record.modes[0].params.difficulty).toBeUndefined();
    expect(record.modes[0].params.optionCount.values).toEqual([2, 3, 4]);
  });
  it("ships a clean, versioned deck with the actual new settings", async () => {
    const zip = await JSZip.loadAsync(readFileSync("public/decks/word_formation_soup_v1.0.57.zip"));
    const text = await zip.file("topic.json").async("string");
    const topic = JSON.parse(text);
    expect(topic.version).toBe("1.0.57");
    expect(topic.meta.version).toBe(topic.version);
    expect(text).not.toContain("\uFFFD");
    expect(topic.cards.every(c => c.wrongForms === undefined)).toBe(true);
    expect(topic.modes.find(m => m.type === "pick_form").params.optionCount.default).toBe(2);
    expect(topic.modes.find(m => m.type === "season_form_pick").params.questionHint.default).toBe(true);
    expect(topic.modes).toHaveLength(3);
    expect(topic.modes.every(m => m.params.materialSet.default === "trained")).toBe(true);
    expect(topic.modes.every(m => m.params.speechEnabled.default === false)).toBe(true);
    expect(topic.modes.find(m => m.type === "season_form_pick").params.category.default).toEqual(["soup"]);
    const transferred = transferCards(topic.cards);
    expect(transferred.filter(c => !c.items)).toHaveLength(23);
    expect(transferred.flatMap(c => c.items ?? [c])).toHaveLength(39);
    for (const card of transferred) {
      const source = topic.cards.find(c => c.id === (card.conceptId ?? card.id));
      expect(source).toBeTruthy();
      if (card.items) {
        expect(card.items.every(item => !source.items.some(old => old.adjPhrase === item.adjPhrase))).toBe(true);
      } else {
        expect(card.adjPhrase).not.toBe(source.adjPhrase);
        expect(card.ingredientImage).toBeUndefined();
      }
    }
  });
});

describe("transfer to authored new combinations", () => {
  const sources = [
    { id: "dom_derevo", category: "materials", nounPhrase: "дом из дерева", adjPhrase: "деревянный дом", ingredientImage: "house.webp" },
    { id: "dom_steklo", category: "materials", nounPhrase: "дом из стекла", adjPhrase: "стеклянный дом", ingredientImage: "house.webp" },
    { id: "sea_osen_overview", category: "seasons", contextPhrase: "Наступила осень", items: [{ id: "coat", adjPhrase: "осенний плащ", image: "coat.webp" }] },
  ];
  it("preserves the source concept while changing the object and removing the old picture", () => {
    const [card] = transferCards(sources);
    expect(card).toMatchObject({ conceptId: "dom_derevo", nounPhrase: "стол из дерева", adjPhrase: "деревянный стол" });
    expect(card.ingredientImage).toBeUndefined();
    expect(sources[0].ingredientImage).toBe("house.webp");
  });
  it("starts transfer with no displayed answer even if a model stage was saved", () => {
    const tasks = generateTasks({ type: "pair_intro" }, sources, 6, { materialSet: "transfer", introStage: "model", category: ["materials"] });
    expect(tasks).toHaveLength(2);
    expect(tasks.every(t => t.params.introStage === "answer")).toBe(true);
  });
  it("builds meaningful choices for new nouns without restoring old images", () => {
    const tasks = generateTasks({ type: "pick_form" }, sources, 6, { materialSet: "transfer", category: ["materials"] });
    expect(tasks).toHaveLength(2);
    expect(tasks.every(t => t.params.showImage === false && t.options.length === 2)).toBe(true);
  });
  it("provides all four agreement forms on new nouns with an explicit season", () => {
    const tasks = generateTasks({ type: "season_form_pick" }, sources, 6, { materialSet: "transfer", questionHint: true, category: ["seasons"] });
    expect(tasks.map(t => t.item.adjPhrase).sort()).toEqual(["осенний день", "осенняя прогулка", "осеннее утро", "осенние каникулы"].sort());
    expect(tasks.every(t => t.params.activityStage === "check" && !t.params.questionHint && !t.item.image)).toBe(true);
  });
  it("does not substitute familiar cards for an unsupported transfer category", () => {
    expect(generateTasks({ type: "pair_intro" }, [{ id: "wea_dozhd", category: "weather" }], 5, { materialSet: "transfer" })).toEqual([]);
  });
});
