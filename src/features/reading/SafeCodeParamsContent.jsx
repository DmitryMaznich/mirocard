import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { useTimer } from "@/features/timer/TimerContext";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import { getInitials } from "@/shared/utils/format";
import { getSafeCodeCustomLocations, saveSafeCodeCustomLocations, saveSafeCodeConfig } from "@/core/groupStore";

const MIN_CODE_LENGTH = 2;
const MAX_CODE_LENGTH = 5;
const DATALIST_ID = "safe-code-saved-locations";

function emptyRow() {
  return { phrase: "", digit: "" };
}

function randomDigits(count) {
  const pool = Array.from({ length: 10 }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export default function SafeCodeParamsContent({ topicId, topicTitle, textTitle, student }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const { markSessionStart } = useTimer();

  const [customLocations, setCustomLocations] = useState([]);
  const [codeLength, setCodeLength] = useState(3);
  const [rows, setRows] = useState(() => Array.from({ length: 3 }, emptyRow));
  const [showManage, setShowManage] = useState(false);

  useEffect(() => {
    getSafeCodeCustomLocations(topicId).then(setCustomLocations).catch(() => {});
  }, [topicId]);

  function changeCodeLength(next) {
    const clamped = Math.max(MIN_CODE_LENGTH, Math.min(MAX_CODE_LENGTH, next));
    setCodeLength(clamped);
    setRows((prev) => {
      const copy = prev.slice(0, clamped);
      while (copy.length < clamped) copy.push(emptyRow());
      return copy;
    });
  }

  function updateRow(index, patch) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function setDigit(index, value) {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 1);
    updateRow(index, { digit: digits });
  }

  function generateRandom() {
    setRows((prev) => {
      const filledIndices = prev.reduce((acc, row, i) => {
        if (row.phrase.trim()) acc.push(i);
        return acc;
      }, []);
      const digits = randomDigits(filledIndices.length);
      return prev.map((row, i) => {
        const pos = filledIndices.indexOf(i);
        return pos === -1 ? row : { ...row, digit: String(digits[pos]) };
      });
    });
  }

  function updateSavedLocation(index, text) {
    setCustomLocations((prev) => prev.map((loc, i) => (i === index ? { label: text, phrase: text } : loc)));
  }

  function persistSavedLocations() {
    saveSafeCodeCustomLocations(topicId, customLocations).catch(() => {});
  }

  function deleteSavedLocation(index) {
    setCustomLocations((prev) => {
      const next = prev.filter((_, i) => i !== index);
      saveSafeCodeCustomLocations(topicId, next).catch(() => {});
      return next;
    });
  }

  const isReady = rows.length === codeLength && rows.every((row) => row.phrase.trim() && row.digit !== "");

  async function startSession() {
    const typedPhrases = rows.map((row) => row.phrase.trim()).filter(Boolean);
    const newOnes = typedPhrases.filter((p) => !customLocations.some((c) => c.phrase === p));
    if (newOnes.length) {
      const merged = [...customLocations, ...newOnes.map((p) => ({ label: p, phrase: p }))];
      setCustomLocations(merged);
      await saveSafeCodeCustomLocations(topicId, merged).catch(() => {});
    }
    await saveSafeCodeConfig(topicId, {
      codeLength,
      locations: rows.map((row) => ({ phrase: row.phrase, digit: Number(row.digit) })),
    }).catch(() => {});
    markSessionStart();
    setScreen("session");
  }

  return (
    <div className="params-layout">
      <div className="params-info-col">
        {topicTitle && <div className="params-info-topic">{topicTitle}</div>}
        {textTitle && <div className="params-info-mode">{textTitle}</div>}
        {student && (
          <div className="params-info-student">
            <div className="params-info-student__avatar">
              {student.photoDataUrl
                ? <img src={student.photoDataUrl} alt={student.name} />
                : getInitials(student.name)
              }
            </div>
            <div className="params-info-student__name">{student.name}</div>
          </div>
        )}
        <div className="params-info-start">
          <Button fullWidth onClick={startSession} disabled={!isReady}>Начать занятие</Button>
        </div>
      </div>

      <div className="params-settings-col">
        <div className="params-body">
          <div className="param-row">
            <div className="param-label">Цифр в коде</div>
            <div className="param-stepper">
              <button className="stepper-btn" disabled={codeLength <= MIN_CODE_LENGTH} onClick={() => changeCodeLength(codeLength - 1)}>−</button>
              <span className="stepper-value">{codeLength}</span>
              <button className="stepper-btn" disabled={codeLength >= MAX_CODE_LENGTH} onClick={() => changeCodeLength(codeLength + 1)}>+</button>
            </div>
          </div>

          <div className="param-row param-row--block">
            <div className="param-label">Где спрятаны цифры</div>
            <div className="safe-code-rows">
              {rows.map((row, i) => (
                <div key={i} className="safe-code-row">
                  <span className="safe-code-row-index">{i + 1}.</span>
                  <input
                    className="safe-code-location-input"
                    list={DATALIST_ID}
                    value={row.phrase}
                    onChange={(e) => updateRow(i, { phrase: e.target.value })}
                    placeholder="например: под подушкой"
                  />
                  <input
                    className="safe-code-digit-input"
                    inputMode="numeric"
                    value={row.digit}
                    onChange={(e) => setDigit(i, e.target.value)}
                    placeholder="?"
                  />
                </div>
              ))}
            </div>
            <datalist id={DATALIST_ID}>
              {customLocations.map((loc) => <option key={loc.phrase} value={loc.phrase} />)}
            </datalist>
            <div className="safe-code-params-actions">
              <button className="link-btn safe-code-generate-btn" onClick={generateRandom}>
                🎲 Сгенерировать случайные
              </button>
              {customLocations.length > 0 && (
                <button className="link-btn" onClick={() => setShowManage(true)}>
                  ✎ Управлять сохранёнными местами
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="params-start-phone">
          <Button fullWidth onClick={startSession} disabled={!isReady}>Начать занятие</Button>
        </div>
      </div>

      {showManage && (
        <Modal title="Сохранённые места" onClose={() => setShowManage(false)}>
          <div className="safe-code-manage-list">
            {customLocations.map((loc, i) => (
              <div key={i} className="safe-code-manage-row">
                <input
                  className="safe-code-manage-input"
                  value={loc.phrase}
                  onChange={(e) => updateSavedLocation(i, e.target.value)}
                  onBlur={persistSavedLocations}
                />
                <button
                  className="safe-code-manage-delete"
                  onClick={() => deleteSavedLocation(i)}
                  aria-label="Удалить место"
                >
                  ✕
                </button>
              </div>
            ))}
            {customLocations.length === 0 && (
              <div className="safe-code-manage-empty">Сохранённых мест пока нет.</div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
