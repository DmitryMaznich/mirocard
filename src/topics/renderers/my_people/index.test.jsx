import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import MyPeopleRenderer from "./index.jsx";
import { isCorrectAssociation } from "./matching";

const persistence = vi.hoisted(() => ({
  markPersonAxisIntroduced: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/features/myPeople/myPeoplePersistence", () => persistence);

describe("people album matching", () => {
  it("accepts the matching person for a name", () => {
    expect(isCorrectAssociation("name", { personId: "anna", label: "Анна" }, { personId: "anna", label: "Анна" })).toBe(true);
    expect(isCorrectAssociation("name", { personId: "pavel", label: "Павел" }, { personId: "anna", label: "Анна" })).toBe(false);
  });

  it("accepts either identical relationship label without making two teachers an impossible task", () => {
    expect(isCorrectAssociation("relation", { personId: "teacher_1", label: "учитель" }, { personId: "teacher_2", label: "учитель" })).toBe(true);
  });
});

describe("people album renderer", () => {
  let container;
  let root;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    root = null;
    container = null;
  });

  it("renders one progress dot for every person alongside the text count", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <MyPeopleRenderer
          task={{
            type: "people_album",
            conceptId: "album:family_names:anna_boris_mila",
            axis: "name",
            prompt: "Подпиши имена",
            answerTitle: "Имена",
            entries: [
              { personId: "anna", image: "", label: "Анна" },
              { personId: "boris", image: "", label: "Борис" },
              { personId: "mila", image: "", label: "Мила" },
            ],
            answers: [
              { id: "answer:anna", personId: "anna", label: "Анна" },
              { id: "answer:boris", personId: "boris", label: "Борис" },
              { id: "answer:mila", personId: "mila", label: "Мила" },
            ],
          }}
          topicId="my_people"
          soundEnabled={false}
          onCorrect={vi.fn()}
          onStreakReset={vi.fn()}
        />,
      );
    });

    expect(container.querySelectorAll(".people-album__progress-dot")).toHaveLength(3);
    expect(container.querySelector(".people-album__answers-progress")?.textContent).toContain("0 из 3");
  });

  it("places a word with a tap on it and a tap on the photo, no dragging needed", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <MyPeopleRenderer
          task={{
            type: "people_album",
            conceptId: "album:family_names:anna_boris",
            axis: "name",
            prompt: "Подпиши имена",
            answerTitle: "Имена",
            entries: [
              { personId: "anna", image: "", label: "Анна" },
              { personId: "boris", image: "", label: "Борис" },
            ],
            answers: [
              { id: "answer:anna", personId: "anna", label: "Анна" },
              { id: "answer:boris", personId: "boris", label: "Борис" },
            ],
          }}
          topicId="my_people"
          soundEnabled={false}
          onCorrect={vi.fn()}
          onStreakReset={vi.fn()}
        />,
      );
    });
    const word = [...container.querySelectorAll(".people-album-answer")].find((button) => button.textContent === "Анна");
    const press = (type) => word.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    act(() => { press("pointerdown"); press("pointerup"); });
    expect(word.getAttribute("aria-pressed")).toBe("true");

    act(() => container.querySelector('[data-person-id="anna"]').click());
    expect(container.querySelector('[data-person-id="anna"] .people-album-photo__label')?.textContent).toBe("Анна");
    expect(word.disabled).toBe(true);
  });
});

describe("person intro renderer", () => {
  let container;
  let root;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    root = null;
    container = null;
    persistence.markPersonAxisIntroduced.mockClear();
  });

  it("renders one calm photo card and confirms the introduced axis", () => {
    const onAdvance = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <MyPeopleRenderer
          task={{
            type: "person_intro",
            conceptId: "intro:family_names:anna:name",
            personId: "anna",
            axis: "name",
            image: "/api/photos/anna",
            label: "Анна",
            promptSpeech: "Это Анна.",
          }}
          topicId="my_people"
          student={{ id: "student_1" }}
          soundEnabled={false}
          onAdvance={onAdvance}
        />,
      );
    });

    expect(container.querySelector(".person-intro__photo")).not.toBeNull();
    expect(container.textContent).toContain("Анна");
    expect(container.querySelector(".people-speaker")?.getAttribute("aria-label")).toBe("Повторить");

    act(() => {
      container.querySelector(".person-intro__next").click();
    });
    expect(persistence.markPersonAxisIntroduced).toHaveBeenCalledWith("student_1", "anna", "name");
    expect(onAdvance).toHaveBeenCalledOnce();
  });
});

describe("«Покажи» renderer", () => {
  let container;
  let root;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    root = null;
    container = null;
  });

  const task = {
    type: "person_point",
    conceptId: "point:anna",
    personId: "anna",
    word: "мама",
    prompt: "Где мама?",
    promptSpeech: "Где мама?",
    choices: [
      { personId: "pavel", image: "data:image/png;base64,AAA" },
      { personId: "anna", image: "data:image/png;base64,BBB" },
    ],
  };

  function mount(props) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<MyPeopleRenderer task={task} topicId="my_people" soundEnabled={false} {...props} />); });
    return [...container.querySelectorAll(".people-point-photo")];
  }

  it("asks with the child's word and counts a first-try tap as correct", () => {
    const onCorrect = vi.fn();
    const onStreakReset = vi.fn();
    const [, mama] = mount({ onCorrect, onStreakReset });

    expect(container.textContent).toContain("Где мама?");
    act(() => mama.click());

    expect(onCorrect).toHaveBeenCalledWith("point:anna", "anna", expect.objectContaining({ autoAdvance: true }));
    expect(onStreakReset).not.toHaveBeenCalled();
    expect(mama.className).toContain("people-point-photo--correct");
  });

  it("after a miss lights the right photo and leaves only it tappable", () => {
    const onCorrect = vi.fn();
    const onStreakReset = vi.fn();
    const [papa, mama] = mount({ onCorrect, onStreakReset });

    act(() => papa.click());
    expect(onStreakReset).toHaveBeenCalledTimes(1);
    expect(mama.className).toContain("people-point-photo--hint");
    expect(papa.disabled).toBe(true);

    act(() => papa.click());
    expect(onStreakReset).toHaveBeenCalledTimes(1);

    act(() => mama.click());
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });

  it("marks a newcomer introduced by the word's axis once found", () => {
    persistence.markPersonAxisIntroduced.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<MyPeopleRenderer task={{ ...task, introduces: true, axis: "relation" }} student={{ id: "s1" }} topicId="my_people" soundEnabled={false} onCorrect={vi.fn()} onStreakReset={vi.fn()} />);
    });
    const [, mama] = container.querySelectorAll(".people-point-photo");
    act(() => mama.click());
    expect(persistence.markPersonAxisIntroduced).toHaveBeenCalledWith("s1", "anna", "relation");
  });
});

describe("«Покажи» with one photo", () => {
  it("praises and moves on without scoring", () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onCorrect = vi.fn();
    const onAdvance = vi.fn();
    act(() => {
      root.render(<MyPeopleRenderer task={{ type: "person_point", conceptId: "point:anna", personId: "anna", word: "мама", prompt: "Где мама?", promptSpeech: "Где мама?", errorless: true, choices: [{ personId: "anna", image: "" }] }} topicId="my_people" soundEnabled={false} onCorrect={onCorrect} onAdvance={onAdvance} />);
    });
    act(() => container.querySelector(".people-point-photo").click());
    act(() => { vi.advanceTimersByTime(1500); });
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(onCorrect).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });
});

describe("«Обо мне» renderer", () => {
  it("no longer offers «Знает» once a hint was shown", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <MyPeopleRenderer
          task={{ type: "about_me_question", conceptId: "about_q:rel:мама", prompt: "Как зовут маму?", promptSpeech: "Как зовут маму?", answer: "Анна", cueImage: "data:image/png;base64,AAA" }}
          topicId="my_people"
          soundEnabled={false}
          onQualityAnswer={vi.fn()}
        />,
      );
    });
    const knows = () => [...container.querySelectorAll(".people-grade")].find((button) => button.textContent === "Знает");
    expect(knows().disabled).toBe(false);
    act(() => [...container.querySelectorAll("button")].find((button) => button.textContent === "Показать фото").click());
    expect(knows().disabled).toBe(true);
    expect([...container.querySelectorAll(".people-grade")].find((button) => button.textContent === "С подсказкой").disabled).toBe(false);
    act(() => root.unmount());
    container.remove();
  });
});

describe("«Кто это?» renderer", () => {
  it("steps through the first syllable and the answer, then allows «С подсказкой» at best", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <MyPeopleRenderer
          task={{ type: "person_naming", conceptId: "person_naming:anna:name", prompt: "Кто это?", promptSpeech: "Кто это?", image: "", answer: "мама · Анна", hintWord: "мама", hintSyllable: "ма" }}
          topicId="my_people"
          soundEnabled={false}
          onQualityAnswer={vi.fn()}
        />,
      );
    });
    const button = (text) => [...container.querySelectorAll("button")].find((item) => item.textContent === text);
    expect(button("Знает").disabled).toBe(false);

    act(() => button("Первый слог").click());
    expect(container.querySelector(".person-naming__syllable")?.textContent).toBe("ма…");
    expect(button("Знает").disabled).toBe(true);
    expect(button("Первый слог")).toBeUndefined();

    act(() => button("Показать ответ").click());
    expect(container.querySelector(".about-me-task__answer--shown")?.textContent).toBe("мама · Анна");
    expect(container.querySelector(".person-naming__syllable")?.textContent).toBe("");
    expect(button("С подсказкой").disabled).toBe(false);
    act(() => root.unmount());
    container.remove();
  });
});

