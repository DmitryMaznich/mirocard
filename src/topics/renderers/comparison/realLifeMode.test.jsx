import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { existsSync, readFileSync, statSync } from "node:fs";
import { REAL_LIFE_SCENES } from "./realLifeScenes.js";
import ComparisonRenderer from "./index.jsx";

describe("Сравнение — «Сравни в жизни»: картинки", () => {
  it("every scene's picture is a file in the topic, none inline in the app code", () => {
    REAL_LIFE_SCENES.forEach((scene) => {
      expect(scene.image).toBe(`media/scenes/${scene.id}.jpg`);
      expect(existsSync(`tools/comparison/${scene.image}`)).toBe(true);
    });
    expect(statSync("src/topics/renderers/comparison/realLifeScenes.js").size).toBeLessThan(50_000);
    expect(readFileSync("src/topics/renderers/comparison/realLifeScenes.js", "utf8")).not.toContain("data:image");
  });

  let container, root;
  afterEach(() => { act(() => root?.unmount()); container?.remove(); });

  it("the screen loads the picture from the installed topic", async () => {
    const asked = [];
    const load = async (topicId, path) => { asked.push([topicId, path]); return "blob:scene"; };
    const scene = REAL_LIFE_SCENES[0];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<ComparisonRenderer
      task={{ type: "compare_real_life", conceptId: "compare_medium", image: scene.image, nameANom: "Петя", nameBNom: "Маша", labelA: "У Пети", labelB: "У Маши", instruction: "У кого больше яблок?", correctAnswer: "b" }}
      mode={{ id: "compare_real_life" }} topicId="comparison" loadTopicFileUrl={load} sessionStatus="task_active" onCorrect={() => {}} onIncorrect={() => {}} />));
    expect(asked).toEqual([["comparison", scene.image]]);
    expect(container.querySelector(".reallife-scene-img").getAttribute("src")).toBe("blob:scene");
  });
});
