import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const CARDS = [
  { id: "ryba",    noun: "рыба",    nounPhrase: "суп из рыбы",    adjPhrase: "рыбный суп",    image: "media/ryba.webp",    audioNounPhrase: "audio/ryba_noun.mp3",    audioAdjPhrase: "audio/ryba_adj.mp3",    difficulty: "easy"   },
  { id: "myaso",   noun: "мясо",    nounPhrase: "суп из мяса",    adjPhrase: "мясной суп",    image: "media/myaso.webp",   audioNounPhrase: "audio/myaso_noun.mp3",   audioAdjPhrase: "audio/myaso_adj.mp3",   difficulty: "easy"   },
  { id: "grib",    noun: "гриб",    nounPhrase: "суп из грибов",  adjPhrase: "грибной суп",   image: "media/grib.webp",    audioNounPhrase: "audio/grib_noun.mp3",    audioAdjPhrase: "audio/grib_adj.mp3",    difficulty: "easy"   },
  { id: "kapusta", noun: "капуста", nounPhrase: "суп из капусты", adjPhrase: "капустный суп", image: "media/kapusta.webp", audioNounPhrase: "audio/kapusta_noun.mp3", audioAdjPhrase: "audio/kapusta_adj.mp3", difficulty: "easy"   },
  { id: "kuritsa", noun: "курица",  nounPhrase: "суп из курицы",  adjPhrase: "куриный суп",   image: "media/kuritsa.webp", audioNounPhrase: "audio/kuritsa_noun.mp3", audioAdjPhrase: "audio/kuritsa_adj.mp3", difficulty: "medium" },
  { id: "goroh",   noun: "горох",   nounPhrase: "суп из гороха",  adjPhrase: "гороховый суп", image: "media/goroh.webp",   audioNounPhrase: "audio/goroh_noun.mp3",   audioAdjPhrase: "audio/goroh_adj.mp3",   difficulty: "medium" },
];

describe("pair_intro", () => {
  it("returns one task with all cards sorted easy→hard", () => {
    const tasks = generateTasks({ type: "pair_intro" }, CARDS, 6, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("pair_intro");
    expect(tasks[0].cards).toHaveLength(6);
    expect(tasks[0].cards[0].difficulty).toBe("easy");
    expect(tasks[0].cards[tasks[0].cards.length - 1].difficulty).toBe("medium");
  });
});

describe("form_it", () => {
  it("returns one task per concept", () => {
    const tasks = generateTasks({ type: "form_it" }, CARDS, 6, { stimulus: "phrase", optionCount: 4 });
    expect(tasks).toHaveLength(6);
  });

  it("each task has exactly one correct option", () => {
    const tasks = generateTasks({ type: "form_it" }, CARDS, 6, { stimulus: "phrase", optionCount: 4 });
    for (const task of tasks) {
      const correct = task.options.filter(o => o.isTarget);
      expect(correct).toHaveLength(1);
      expect(correct[0].adjPhrase).toBe(CARDS.find(c => c.id === task.conceptId).adjPhrase);
    }
  });

  it("stimulus phrase uses nounPhrase when params.stimulus is 'phrase'", () => {
    const tasks = generateTasks({ type: "form_it" }, CARDS, 6, { stimulus: "phrase", optionCount: 4 });
    expect(tasks[0].stimulus).toBe("phrase");
    expect(tasks[0].stimulusText).toBeTruthy();
  });

  it("stimulus is image when params.stimulus is 'image'", () => {
    const tasks = generateTasks({ type: "form_it" }, CARDS, 6, { stimulus: "image", optionCount: 4 });
    expect(tasks[0].stimulus).toBe("image");
    expect(tasks[0].stimulusImage).toBeTruthy();
  });

  it("mixed produces both stimuli types", () => {
    const tasks = generateTasks({ type: "form_it" }, CARDS, 6, { stimulus: "mixed", optionCount: 4 });
    const stimuli = tasks.map(t => t.stimulus);
    expect(stimuli).toContain("phrase");
    expect(stimuli).toContain("image");
  });
});

describe("yes_no", () => {
  it("returns repsPerConcept tasks per concept", () => {
    const tasks = generateTasks({ type: "yes_no" }, CARDS, 6, { repsPerConcept: 2 });
    expect(tasks).toHaveLength(12);
  });

  it("roughly 60% of tasks are correct (40–90% range for 60 tasks)", () => {
    const tasks = generateTasks({ type: "yes_no" }, CARDS, 6, { repsPerConcept: 10 });
    const correctCount = tasks.filter(t => t.isCorrect).length;
    expect(correctCount).toBeGreaterThan(tasks.length * 0.4);
    expect(correctCount).toBeLessThan(tasks.length * 0.9);
  });

  it("each task has image and displayPhrase", () => {
    const tasks = generateTasks({ type: "yes_no" }, CARDS, 6, {});
    for (const task of tasks) {
      expect(task.image).toBeTruthy();
      expect(task.displayPhrase).toBeTruthy();
      expect(typeof task.isCorrect).toBe("boolean");
    }
  });
});

describe("question_ask", () => {
  it("returns one task per concept sorted easy→hard", () => {
    const tasks = generateTasks({ type: "question_ask" }, CARDS, 6, {});
    expect(tasks).toHaveLength(6);
    expect(tasks[0].difficulty).toBe("easy");
    expect(tasks[tasks.length - 1].difficulty).toBe("medium");
  });

  it("each task has stimulusImage, stimulusText, correctAdjPhrase", () => {
    const tasks = generateTasks({ type: "question_ask" }, CARDS, 6, {});
    for (const task of tasks) {
      expect(task.stimulusImage).toBeTruthy();
      expect(task.stimulusText).toBeTruthy();
      expect(task.correctAdjPhrase).toBeTruthy();
    }
  });
});
