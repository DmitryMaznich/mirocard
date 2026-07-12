import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import PinGateModal from "@/shared/components/PinGateModal";
import { getAllInstructions } from "./instructionsApi";
import "./instructions.css";

export default function InstructionsTab({ setScreen }) {
  const settings = useAppStore((s) => s.settings);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const setActiveInstructionId = useAppStore((s) => s.setActiveInstructionId);
  const setInstructionConstructorId = useAppStore((s) => s.setInstructionConstructorId);
  const adultPinHash = settings.adultPinHash ?? null;

  const [instructions, setInstructions] = useState(undefined); // undefined = loading
  const [pinGateAction, setPinGateAction] = useState(null); // null | { type: "create" } | { type: "edit", id }

  useEffect(() => {
    let cancelled = false;
    getAllInstructions().then((all) => { if (!cancelled) setInstructions(all); });
    return () => { cancelled = true; };
  }, []);

  function openInstruction(id) {
    setActiveInstructionId(id);
    setScreen("instruction_runner");
  }

  function requestCreate() {
    setPinGateAction({ type: "create" });
  }

  function requestEdit(id) {
    setPinGateAction({ type: "edit", id });
  }

  // First-time PIN setup — mirrors SettingsScreen.jsx's handleSetNewPin so a
  // family with no adult PIN yet actually gets one persisted, instead of the
  // gate silently granting access every time without ever saving anything.
  async function handleSetPin(hash) {
    patchSettings({ adultPinHash: hash });
    const db = await getDb();
    await kv.set(db, "settings", { ...useAppStore.getState().settings, adultPinHash: hash });
    api.patch("/account/settings", { adultPinHash: hash }).catch(() => {});
  }

  function handlePinSuccess() {
    const action = pinGateAction;
    setPinGateAction(null);
    if (!action) return;
    setInstructionConstructorId(action.type === "edit" ? action.id : null);
    setScreen("instruction_constructor");
  }

  if (instructions === undefined) {
    return <div className="home-tab-loading">Загрузка…</div>;
  }

  return (
    <div className="instructions-home">
      <div className="ig-head">
        <div className="ig-eyebrow">Инструкции</div>
        <h1 className="ig-title">Что разберём сегодня?</h1>
        <p className="ig-sub">Пошаговые подсказки для важных дел</p>
      </div>
      <div className="ig-scroll">
        <div className="ig-grid">
          {instructions.map((instruction) => (
            instruction.builtin ? (
              <button
                type="button"
                key={instruction.id}
                className="ig-card"
                onClick={() => openInstruction(instruction.id)}
              >
                <span className="ig-card__emoji">{instruction.emoji}</span>
                <span className="ig-card__title">{instruction.title}</span>
              </button>
            ) : (
              <div key={instruction.id} className="ig-card ig-card--mine">
                <span className="ig-card__tag">Моя</span>
                <button type="button" className="ig-card__main-btn" onClick={() => openInstruction(instruction.id)}>
                  <span className="ig-card__emoji">{instruction.emoji}</span>
                  <span className="ig-card__title">{instruction.title}</span>
                </button>
                <button
                  type="button"
                  className="ig-card__pencil"
                  onClick={() => requestEdit(instruction.id)}
                  aria-label="Редактировать"
                >
                  ✎
                </button>
              </div>
            )
          ))}
          <button type="button" className="ig-card ig-card--add" onClick={requestCreate}>
            <span className="ig-card__plus">+</span>
            <span className="ig-card__title">Создать свою</span>
            <span className="ig-card__lock">🔒 для родителя</span>
          </button>
        </div>
      </div>

      {pinGateAction && (
        <PinGateModal
          pinHash={adultPinHash}
          onSuccess={handlePinSuccess}
          onSetPin={handleSetPin}
          onCancel={() => setPinGateAction(null)}
        />
      )}
    </div>
  );
}
