import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMyPeopleTopicRecord } from "@/topics/builtinMyPeopleTopic";

const speech = vi.hoisted(() => ({ speak: vi.fn() }));
vi.mock("@/shared/hooks/useSpeech", () => ({ useSpeech: () => ({ speak: speech.speak }) }));
vi.mock("@/features/myPeople/myPeoplePersistence", () => ({ markPersonAxisIntroduced: vi.fn(() => Promise.resolve(true)) }));

const { default: MyPeopleRenderer } = await import("./index.jsx");

const task = {
  type: "person_point", conceptId: "point:anna", personId: "anna", word: "мама", prompt: "Где мама?", promptSpeech: "Где мама?",
  choices: [{ personId: "pavel", image: "" }, { personId: "anna", image: "" }],
};

describe("«Озвучка» in every «Мои люди» mode", () => {
  let container;
  let root;
  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    speech.speak.mockClear();
  });

  function mount(sessionParams) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<MyPeopleRenderer task={task} topicId="my_people" soundEnabled sessionParams={sessionParams} onCorrect={vi.fn()} onStreakReset={vi.fn()} />);
    });
  }

  it("speaks and offers «hear it again» by default", () => {
    mount({});
    expect(speech.speak).toHaveBeenCalledWith("Где мама?");
    expect(container.querySelector(".people-speaker")).not.toBeNull();
  });

  it("switched off: no speech at all, not even after a tap, and no speaker button", () => {
    mount({ voice: false });
    expect(container.querySelector(".people-speaker")).toBeNull();
    act(() => container.querySelectorAll(".people-point-photo")[1].click());
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it("is a setting of every mode, on by default", () => {
    for (const mode of buildMyPeopleTopicRecord().modes) {
      expect(mode.params.voice).toEqual(expect.objectContaining({ type: "boolean", default: true }));
    }
  });
});

describe("people album word sound", () => {
  let container;
  let root;
  afterEach(() => {
    root?.unmount();
    container?.remove();
    speech.speak.mockClear();
  });

  function mountAlbum(sessionParams) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <MyPeopleRenderer
          task={{
            type: "people_album",
            conceptId: "album:label_photos:relation:anna_boris",
            axis: "relation",
            prompt: "Подпиши: кто это",
            answerTitle: "Кто это",
            entries: [{ personId: "anna", image: "", label: "мама" }, { personId: "boris", image: "", label: "папа" }],
            answers: [{ id: "answer:anna", personId: "anna", label: "мама" }, { id: "answer:boris", personId: "boris", label: "папа" }],
          }}
          topicId="my_people"
          soundEnabled
          sessionParams={sessionParams}
          onCorrect={vi.fn()}
          onStreakReset={vi.fn()}
        />,
      );
    });
    const word = [...container.querySelectorAll(".people-album-answer")].find((button) => button.textContent === "мама");
    act(() => word.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })));
  }

  it("says the word as it is picked", () => {
    mountAlbum({});
    expect(speech.speak).toHaveBeenCalledWith("мама");
  });

  it("keeps quiet with «Озвучивать слово при нажатии» off, so the child reads it", () => {
    mountAlbum({ speakWords: false });
    expect(speech.speak).not.toHaveBeenCalledWith("мама");
  });
});
