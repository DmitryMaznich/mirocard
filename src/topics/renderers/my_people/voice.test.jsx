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
