import { useUiTranslation } from "@/shared/i18n/useUiTranslation";
import { ParkingPreview } from "./ParkingArt";
import { useAppStore } from "@/core/store";
import { endContinuePick, isContinuePick, saveContinueChoice } from "@/features/topics/topicUiPreviewModel";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { RaceCar } from "./RaceArt";
import { TowerPreview } from "./TowerScene";
import { WaterPreview } from "./WaterScene";
import { TugPreview } from "./TugScene";
import "./games.css";

export default function GamesHome() {
  const {t}=useUiTranslation();
  const setScreen = useAppStore(s => s.setScreen);
  const setActiveModeId = useAppStore(s => s.setActiveModeId);
  const studentId = useAppStore(s => s.activeStudentId);
  const topicId = useAppStore(s => s.activeTopicId);

  function chooseGame(modeId) {
    setActiveModeId(modeId);
    if (isContinuePick()) {
      saveContinueChoice(studentId, { topicId, modeId });
      endContinuePick();
      setScreen("home");
      return;
    }
    setScreen("params");
  }

  return <main className="games-home">
    <header className="games-header">
      <button className="games-icon" aria-label="На главный экран" onClick={() => setScreen("home")}><BackArrowIcon /></button>
      <h1>Игры</h1>
    </header>
    <div className="games-library">
      <button className="games-tile" onClick={() => chooseGame("dice_race")}>
        <span className="games-tile__art"><RaceCar /><span className="games-tile__flag" aria-hidden="true">⚑</span></span>
        <strong>Гонки</strong>
        <span>Два игрока и настоящие кубики</span>
        <span className="games-tile__play">Играть <span aria-hidden="true">→</span></span>
      </button>
      <button className="games-tile" onClick={() => chooseGame("skyscrapers")}>
        <span className="games-tile__art games-tile__art--tower"><TowerPreview /></span>
        <strong>Дом до облаков</strong>
        <span>Строим небоскрёбы до 20 этажей</span>
        <span className="games-tile__play">Играть <span aria-hidden="true">→</span></span>
      </button>
      <button className="games-tile" onClick={() => chooseGame("water_fill")}>
        <span className="games-tile__art games-tile__art--water"><WaterPreview /></span>
        <strong>Наливаем до краёв</strong>
        <span>Персонажи, краны и два стакана воды</span>
        <span className="games-tile__play">Играть <span aria-hidden="true">→</span></span>
      </button>
      <button className="games-tile" onClick={() => chooseGame("tug_of_war")}>
        <span className="games-tile__art games-tile__art--tug"><TugPreview /></span>
        <strong>Перетягивание каната</strong>
        <span>Тянем ленточку за свою линию</span>
        <span className="games-tile__play">Играть <span aria-hidden="true">→</span></span>
      </button>
      <button className="games-tile" onClick={() => chooseGame("parking")}>
        <span className="games-tile__art games-tile__art--parking"><ParkingPreview /></span>
        <strong>{t("parking.title")}</strong>
        <span>{t("parking.description")}</span>
        <span className="games-tile__play">{t("parking.play")} <span aria-hidden="true">→</span></span>
      </button>
    </div>
  </main>;
}
