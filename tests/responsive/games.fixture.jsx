import React from "react";
import { createRoot } from "react-dom/client";
import { useAppStore } from "../../src/core/store.js";
import ModePickerScreen from "../../src/features/home/ModePickerScreen.jsx";
import HomePreview from "../../src/features/home/HomePreview.jsx";
import GamesScreen from "../../src/features/games/GamesScreen.jsx";
import { buildGamesTopicRecord } from "../../src/topics/builtinGamesTopic.js";
import "../../src/styles.css";

const withPreviousLesson = new URLSearchParams(location.search).has("recent");
const previousTopic = { meta: { id: "previous_topic", title: { ru: "Предыдущая тема" } }, modes: [], cards: [] };
useAppStore.setState({
  screen:"modes", activeStudentId:"race-kid", activeTopicId:"games", activeModeId:"dice_race",
  students:[{id:"race-kid",name:"Мирон",sex:"m",rewardSettings:{duration:"60"},rewardVideos:["https://youtu.be/aaaaaaaaaaa"]}],
  topicRecords:withPreviousLesson?[previousTopic,buildGamesTopicRecord()]:[buildGamesTopicRecord()],
  sessions:withPreviousLesson?[{studentId:"race-kid",topicId:"previous_topic",completedAt:new Date(Date.now()-60_000).toISOString()}]:[],
});
function Fixture() {
  const screen = useAppStore(s => s.screen);
  if (screen === "home") return <HomePreview />;
  return screen === "params" ? <GamesScreen /> : <ModePickerScreen />;
}
createRoot(document.getElementById("root")).render(<Fixture />);
