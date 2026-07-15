import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import PinGateModal from "@/shared/components/PinGateModal";
import { getAllInstructions, pullUserInstructionsFromServer } from "./instructionsApi";
import "./instructions.css";

function pluralizeSteps(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "шаг";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "шага";
  return "шагов";
}

// Each card gets its own "ink" color instead of one flat teal for every
// card — picked deterministically from the instruction id so the same
// card always lands on the same color, but the grid as a whole reads as
// a varied card catalog rather than a two-tone (builtin/mine) grid.
const INK_PALETTE = [
  { a: "#6fc0b1", b: "#2f7a6d", c: "#235a51" }, // teal
  { a: "#e8b08e", b: "#c2624a", c: "#8f4433" }, // terracotta
  { a: "#9ecf9e", b: "#5f9a5a", c: "#3f6e3c" }, // sage
  { a: "#a9c3e0", b: "#5c85ac", c: "#3e5c78" }, // dusty blue
  { a: "#d3a8dd", b: "#935fae", c: "#6a4180" }, // plum
  { a: "#f0b96e", b: "#c9822f", c: "#9c5c1f" }, // amber
];

function inkForId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return INK_PALETTE[Math.abs(hash) % INK_PALETTE.length];
}

function InstructionCardContent({ instruction }) {
  const ink = inkForId(instruction.id);
  return (
    <>
      <div className="ig-card__punch" />
      <div
        className="ig-card__medallion"
        style={{ "--ink-a": ink.a, "--ink-b": ink.b, "--ink-c": ink.c }}
      >
        <span className="ig-card__emoji">{instruction.emoji}</span>
      </div>
      <div className="ig-card__stitch" />
      <div className="ig-card__body">
        <span className="ig-card__eyebrow" style={{ color: ink.b }}>
          {instruction.steps.length} {pluralizeSteps(instruction.steps.length)}
        </span>
        <span className="ig-card__title">{instruction.title}</span>
      </div>
    </>
  );
}

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
    (async () => {
      await pullUserInstructionsFromServer().catch(() => {});
      const all = await getAllInstructions();
      if (!cancelled) setInstructions(all);
    })();
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
        <h1 className="ig-title">Что делаем сегодня?</h1>
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
                <InstructionCardContent instruction={instruction} />
              </button>
            ) : (
              <div key={instruction.id} className="ig-card ig-card--mine">
                <button type="button" className="ig-card__main-btn" onClick={() => openInstruction(instruction.id)}>
                  <InstructionCardContent instruction={instruction} />
                </button>
                <span className="ig-card__pin" aria-hidden>📌</span>
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
            <span className="ig-card__title">Создать своё</span>
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
