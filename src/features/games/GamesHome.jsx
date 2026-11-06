import { useAppStore } from "@/core/store";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { RaceCar } from "./RaceArt";
import "./games.css";

export default function GamesHome() {
  const setScreen = useAppStore(s => s.setScreen);
  const setActiveModeId = useAppStore(s => s.setActiveModeId);
  return <main className="games-home">
    <header className="games-header">
      <button className="games-icon" aria-label="На главный экран" onClick={() => setScreen("home")}><BackArrowIcon /></button>
      <h1>Игры</h1>
    </header>
    <div className="games-library">
      <button className="games-tile" onClick={() => { setActiveModeId("dice_race"); setScreen("params"); }}>
        <span className="games-tile__art"><RaceCar /><span className="games-tile__flag" aria-hidden="true">⚑</span></span>
        <strong>Гонки</strong>
        <span>Два игрока и настоящие кубики</span>
        <span className="games-tile__play">Играть <span aria-hidden="true">→</span></span>
      </button>
    </div>
  </main>;
}
