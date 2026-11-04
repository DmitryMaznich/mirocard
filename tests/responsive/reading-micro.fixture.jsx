import { useState } from "react";
import { createRoot } from "react-dom/client";
import ReadingRenderer from "../../src/topics/renderers/reading/index.jsx";
import { generateTasks } from "../../src/topics/renderers/reading/engine.js";
import { getDb } from "../../src/core/db.js";
import { importTopic } from "../../src/topics/topicLoader.js";
import "../../src/styles.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";
import "./reading-micro.css";

const bytes = await (await fetch("/decks/reading_short_stories_v2.0.5.zip")).arrayBuffer();
const topic = await importTopic(await getDb(), bytes, "99.0.0");
const stories = topic.texts.filter((story) => story.storyStage === "micro");

function Preview() {
  const [storyId, setStoryId] = useState(stories[0].id);
  const [mode, setMode] = useState(new URLSearchParams(location.search).get("mode") ?? "read_text");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [result, setResult] = useState("");
  const tasks = generateTasks({ type: mode }, topic, storyId, { selectedMicroStories: [storyId] });
  const storyIndex = stories.findIndex((story) => story.id === storyId);
  const task = { ...tasks[questionIndex % tasks.length], storyIndex, storyCount: stories.length };
  function advance(outcome = "") { setResult(outcome); setQuestionIndex((value) => value + 1); }
  function changeStory(id) { setStoryId(id); setQuestionIndex(0); setResult(""); }
  function changeMode(value) { setMode(value); setQuestionIndex(0); setResult(""); }
  return <div className="micro-preview">
    <header className="micro-preview__toolbar">
      <div className="micro-preview__brand">
        <span className="micro-preview__brand-icon" aria-hidden="true"><svg width="23" height="23" viewBox="0 0 24 24" fill="none"><path d="M12 6v14M12 6C9 4 6 3.5 3 4v14c3-.5 6 0 9 2 3-2 6-2.5 9-2V4c-3-.5-6 0-9 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg></span>
        <div><strong>Короткие рассказы</strong><span>Первая ступень</span></div>
      </div>
      <div className="micro-preview__controls">
        <label className="micro-preview__story-select"><span>Рассказ</span><select aria-label="Рассказ" value={storyId} onChange={(event) => changeStory(event.target.value)}>
          {stories.map((story, index) => <option value={story.id} key={story.id}>{String(index + 1).padStart(2, "0")} · {story.title.ru}</option>)}
        </select></label>
        <div className="micro-preview__modes" role="group" aria-label="Занятие">
          <button type="button" aria-pressed={mode === "read_text"} onClick={() => changeMode("read_text")}>Читаем вместе</button>
          <button type="button" aria-pressed={mode === "story_quiz"} onClick={() => changeMode("story_quiz")}>Ищем ответы</button>
        </div>
      </div>
    </header>
    <span className={`micro-preview__result${result ? " micro-preview__result--visible" : ""}`} role="status" data-outcome={result}>{result === "prompted" ? "Ответ с помощью" : result === "independent" ? "Самостоятельно" : result === "none" ? "Пока нет ответа" : result}</span>
    <div className="session-screen session-screen--micro-reading">
      <div className="session-renderer-wrap">
        <ReadingRenderer key={`${storyId}_${mode}_${questionIndex}`} task={task} topicId={topic.meta.id} sessionParams={{}}
          onCorrect={() => advance("independent")} onQualityAnswer={(quality) => advance(quality)}
          onIncorrect={() => setResult("Попробуй ещё раз")}
          onAdvance={() => mode === "read_text" ? changeStory(stories[(storyIndex + 1) % stories.length].id) : advance()}
          onPrevious={() => mode === "read_text" ? changeStory(stories[Math.max(0, storyIndex - 1)].id) : setQuestionIndex((value) => Math.max(0, value - 1))} />
      </div>
    </div>
  </div>;
}
createRoot(document.getElementById("root")).render(<Preview />);
