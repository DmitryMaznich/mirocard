import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import MyPeopleRenderer from "./index.jsx";
import { isCorrectAssociation } from "./matching";

const persistence = vi.hoisted(() => ({
  markPersonAxisIntroduced: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/features/myPeople/myPeoplePersistence", () => persistence);

// A grade button holds a coloured mark and a label; match by the label.
const buttonLabel = (button) => button.querySelector(".people-grade__label")?.textContent ?? button.textContent;

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

  it("renders one progress dot for every person, the count only for screen readers", () => {
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
    expect(container.querySelector(".people-album__answers-progress")?.getAttribute("aria-label")).toBe("Подписано 0 из 3");
    // No instructions for the adult on the child's screen.
    expect(container.textContent).not.toMatch(/Перетащи|нажми/);
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

  it("after a miss lights the word's own photo and keeps the word picked", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const onStreakReset = vi.fn();
    act(() => {
      root.render(
        <MyPeopleRenderer
          task={{
            type: "people_album",
            conceptId: "album:label_photos:relation:anna_boris",
            axis: "relation",
            prompt: "Подпиши: кто это",
            answerTitle: "Кто это",
            entries: [
              { personId: "anna", conceptId: "anna:relation", image: "", label: "мама" },
              { personId: "boris", conceptId: "boris:relation", image: "", label: "папа" },
            ],
            answers: [
              { id: "answer:anna", personId: "anna", label: "мама" },
              { id: "answer:boris", personId: "boris", label: "папа" },
            ],
          }}
          topicId="my_people"
          soundEnabled={false}
          onCorrect={vi.fn()}
          onStreakReset={onStreakReset}
        />,
      );
    });
    const words = [...container.querySelectorAll(".people-album-answer")];
    const tap = (button) => act(() => {
      for (const type of ["pointerdown", "pointerup"]) button.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    });
    const mama = words.find((button) => button.textContent === "мама");
    const papa = words.find((button) => button.textContent === "папа");
    const photo = (id) => container.querySelector(`[data-person-id="${id}"]`);

    tap(mama);
    act(() => photo("boris").click());
    expect(onStreakReset).toHaveBeenCalledTimes(1);
    expect(photo("anna").className).toContain("people-album-photo--hint");
    expect(mama.getAttribute("aria-pressed")).toBe("true");

    // Picking the other word puts the light out.
    tap(papa);
    expect(photo("anna").className).not.toContain("people-album-photo--hint");
    tap(mama);
    expect(photo("anna").className).toContain("people-album-photo--hint");

    act(() => photo("anna").click());
    expect(photo("anna").className).toContain("people-album-photo--matched");
    expect(photo("anna").className).not.toContain("people-album-photo--hint");
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

  it("lets the child touch the photo: the word settles under it and the lesson moves on", () => {
    vi.useFakeTimers();
    try {
      const onAdvance = vi.fn();
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      act(() => {
        root.render(
          <MyPeopleRenderer
            task={{ type: "person_intro", conceptId: "intro:label_photos:anna:relation", personId: "anna", axis: "relation", image: "", label: "мама", promptSpeech: "Это мама." }}
            topicId="my_people"
            student={{ id: "student_1" }}
            soundEnabled={false}
            onAdvance={onAdvance}
          />,
        );
      });
      const photo = container.querySelector(".person-intro__photo-wrap");
      expect(container.querySelector(".person-intro__label--placed")).toBeNull();
      act(() => photo.click());
      expect(container.querySelector(".person-intro__label--placed")?.textContent).toBe("мама");
      expect(onAdvance).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(1400); });
      expect(persistence.markPersonAxisIntroduced).toHaveBeenCalledWith("student_1", "anna", "relation");
      expect(onAdvance).toHaveBeenCalledOnce();
      // A second touch does nothing more.
      act(() => photo.click());
      act(() => { vi.advanceTimersByTime(1400); });
      expect(onAdvance).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
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
    // Found only after the correction: the trial is asked again later.
    expect(onCorrect).toHaveBeenCalledWith("point:anna", "anna", expect.objectContaining({ retryLater: true }));
  });

  it("asks for no repeat after a first-try answer", () => {
    const onCorrect = vi.fn();
    const [, mama] = mount({ onCorrect, onStreakReset: vi.fn() });
    act(() => mama.click());
    expect(onCorrect).toHaveBeenCalledWith("point:anna", "anna", expect.objectContaining({ retryLater: false }));
  });

  it("lights the right photo after the pause set in «Подсказка через»", () => {
    vi.useFakeTimers();
    try {
      const onCorrect = vi.fn();
      const onStreakReset = vi.fn();
      const [papa, mama] = mount({ onCorrect, onStreakReset, sessionParams: { promptDelay: 3 } });

      act(() => { vi.advanceTimersByTime(2900); });
      expect(mama.className).not.toContain("people-point-photo--hint");
      act(() => { vi.advanceTimersByTime(200); });
      expect(mama.className).toContain("people-point-photo--hint");
      expect(papa.className).toContain("people-point-photo--faded");
      expect(papa.disabled).toBe(true);
      expect(onStreakReset).toHaveBeenCalledTimes(1);

      act(() => mama.click());
      expect(onCorrect).toHaveBeenCalledWith("point:anna", "anna", expect.objectContaining({ retryLater: true }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits as long as it takes with «Подсказка через: нет»", () => {
    vi.useFakeTimers();
    try {
      const onStreakReset = vi.fn();
      const [, mama] = mount({ onCorrect: vi.fn(), onStreakReset, sessionParams: { promptDelay: 0 } });
      act(() => { vi.advanceTimersByTime(60_000); });
      expect(mama.className).not.toContain("people-point-photo--hint");
      expect(onStreakReset).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
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

describe("«Обо мне» renderer", () => {
  it("no longer offers «Сам» once a hint was shown", () => {
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
    const knows = () => [...container.querySelectorAll(".people-grade")].find((button) => buttonLabel(button) === "Сам");
    expect(knows().disabled).toBe(false);
    act(() => [...container.querySelectorAll("button")].find((button) => button.textContent === "Показать фото").click());
    expect(knows().disabled).toBe(true);
    expect([...container.querySelectorAll(".people-grade")].find((button) => buttonLabel(button) === "С подсказкой").disabled).toBe(false);
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
    const button = (text) => [...container.querySelectorAll("button")].find((item) => buttonLabel(item) === text);
    expect(button("Сам").disabled).toBe(false);

    act(() => button("Первый слог").click());
    expect(container.querySelector(".person-naming__syllable")?.textContent).toBe("ма…");
    expect(button("Сам").disabled).toBe(true);
    // A used step stays on the adult's panel, ticked and inactive.
    expect(button("Первый слог").disabled).toBe(true);

    act(() => button("Показать ответ").click());
    // The stage shows the child's word to echo, the adult's panel both answers.
    expect(container.querySelector(".about-me-task__answer--shown")?.textContent).toBe("мама");
    expect(container.querySelector(".people-adult__label")?.textContent).toBe("Ответ: мама · Анна");
    expect(container.querySelector(".person-naming__syllable")?.textContent).toBe("");
    expect(button("С подсказкой").disabled).toBe(false);
    act(() => root.unmount());
    container.remove();
  });
});

describe("«Представься» renderer", () => {
  const task = {
    type: "introduce_turn", conceptId: "introduce:name", partner: "Доктор", prompt: "Как тебя зовут?", promptSpeech: "Здравствуй! Как тебя зовут?",
    starter: "Меня зовут …", answer: "Меня зовут Лиза.",
  };
  function mount(hintLevel) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => { root.render(<MyPeopleRenderer task={{ ...task, hintLevel }} topicId="my_people" soundEnabled={false} onQualityAnswer={vi.fn()} />); });
    const button = (text) => [...container.querySelectorAll("button")].find((item) => buttonLabel(item) === text);
    return { container, button, done: () => { act(() => root.unmount()); container.remove(); } };
  }

  it("without a script grades freely, then fades in the starter and the answer", () => {
    const { container, button, done } = mount(0);
    expect(container.textContent).toContain("С тобой знакомится: Доктор");
    expect(button("Сам").disabled).toBe(false);
    act(() => button("Начало фразы").click());
    expect(container.querySelector(".introduce-turn__starter")?.textContent).toBe("Меня зовут …");
    expect(button("Сам").disabled).toBe(true);
    act(() => button("Весь ответ").click());
    expect(container.querySelector(".about-me-task__answer--shown")?.textContent).toBe("Меня зовут Лиза.");
    done();
  });

  it("starting from the whole script shows it at once and allows «С подсказкой» at best", () => {
    const { container, button, done } = mount(2);
    expect(container.querySelector(".about-me-task__answer--shown")?.textContent).toBe("Меня зовут Лиза.");
    expect(button("Начало фразы").disabled).toBe(true);
    expect(button("Сам").disabled).toBe(true);
    expect(button("С подсказкой").disabled).toBe(false);
    done();
  });
});

describe("«Найди такого же» renderer", () => {
  it("shows the sample apart from the choices and counts the right one", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onCorrect = vi.fn();
    act(() => {
      root.render(
        <MyPeopleRenderer
          task={{ type: "person_match", conceptId: "match:anna", personId: "anna", sample: "data:image/png;base64,S", prompt: "Найди такого же", promptSpeech: "Найди такого же.", correctSpeech: "Правильно!", missSpeech: "Смотри, вот.", choices: [{ personId: "pavel", image: "data:image/png;base64,P" }, { personId: "anna", image: "data:image/png;base64,A" }] }}
          topicId="my_people"
          soundEnabled={false}
          onCorrect={onCorrect}
          onStreakReset={vi.fn()}
        />,
      );
    });
    expect(container.querySelector(".people-match__sample img")?.getAttribute("src")).toBe("data:image/png;base64,S");
    const photos = container.querySelectorAll(".people-point-photo");
    expect(photos).toHaveLength(2);
    act(() => photos[1].click());
    expect(onCorrect).toHaveBeenCalledWith("match:anna", "anna", expect.objectContaining({ autoAdvance: true }));
    act(() => root.unmount());
    container.remove();
  });
});

