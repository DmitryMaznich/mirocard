import React from "react";
import { createRoot } from "react-dom/client";
import { useAppStore } from "../../src/core/store.js";
import ModePickerScreen from "../../src/features/home/ModePickerScreen.jsx";
import GamesScreen from "../../src/features/games/GamesScreen.jsx";
import { buildGamesTopicRecord } from "../../src/topics/builtinGamesTopic.js";
import "../../src/styles.css";

useAppStore.setState({
  screen:"modes", activeStudentId:"race-kid", activeTopicId:"games", activeModeId:"dice_race",
  students:[{id:"race-kid",name:"Мирон",rewardSettings:{duration:"60"},rewardVideos:["https://youtu.be/aaaaaaaaaaa"]}],
  topicRecords:[buildGamesTopicRecord()],
});
function Fixture() {
  const screen = useAppStore(s => s.screen);
  return screen === "params" ? <GamesScreen /> : <ModePickerScreen />;
}
createRoot(document.getElementById("root")).render(<Fixture />);
