import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { useTimer } from "@/features/timer/TimerContext";
import Button from "@/shared/components/Button";
import { getInitials } from "@/shared/utils/format";
import { getSafeCodeCustomLocations, saveSafeCodeCustomLocations, saveSafeCodeConfig } from "@/core/groupStore";

const CUSTOM_VALUE = "__custom__";
const MIN_CODE_LENGTH = 2;
const MAX_CODE_LENGTH = 5;

function emptyRow() {
  return { locationId: "", customText: "", phrase: "", digit: "" };
}

function randomDigits(count) {
  const pool = Array.from({ length: 10 }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export default function SafeCodeParamsContent({ topicId, spots, topicTitle, textTitle, student }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const { markSessionStart } = useTimer();

  const [customLocations, setCustomLocations] = useState([]);
  const [codeLength, setCodeLength] = useState(3);
  const [rows, setRows] = useState(() => Array.from({ length: 3 }, emptyRow));

  useEffect(() => {
    getSafeCodeCustomLocations(topicId).then(setCustomLocations).catch(() => {});
  }, [topicId]);

  const allOptions = [...spots, ...customLocations];

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

  function selectLocation(index, value) {
    if (value === CUSTOM_VALUE) {
      updateRow(index, { locationId: CUSTOM_VALUE, phrase: "" });
      return;
    }
    const option = allOptions.find((o) => (o.id ?? o.phrase) === value);
    updateRow(index, { locationId: value, phrase: option?.phrase ?? "", customText: "" });
  }

  function setCustomText(index, text) {
    updateRow(index, { customText: text, phrase: text });
  }

  function setDigit(index, value) {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 1);
    updateRow(index, { digit: digits });
  }

  function generateRandom() {
    const filled = rows.filter((row) => row.phrase.trim());
    const digits = randomDigits(filled.length);
    let d = 0;
    setRows((prev) => prev.map((row) => {
      if (!row.phrase.trim()) return row;
      const digit = String(digits[d]);
      d += 1;
      return { ...row, digit };
    }));
  }

  const isReady = rows.length === codeLength && rows.every((row) => row.phrase.trim() && row.digit !== "");

  async function startSession() {
    const newCustom = rows
      .filter((row) => row.locationId === CUSTOM_VALUE && row.customText.trim())
      .map((row) => ({ label: row.customText.trim(), phrase: row.customText.trim() }));
    if (newCustom.length) {
      const merged = [...customLocations];
      for (const loc of newCustom) {
        if (!merged.some((m) => m.phrase === loc.phrase)) merged.push(loc);
      }
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
                  <select
                    className="safe-code-location-select"
                    value={row.locationId}
                    onChange={(e) => selectLocation(i, e.target.value)}
                  >
                    <option value="" disabled>Выбери место</option>
                    {allOptions.map((opt) => (
                      <option key={opt.id ?? opt.phrase} value={opt.id ?? opt.phrase}>{opt.label}</option>
                    ))}
                    <option value={CUSTOM_VALUE}>Своё место…</option>
                  </select>
                  {row.locationId === CUSTOM_VALUE && (
                    <input
                      className="safe-code-custom-input"
                      value={row.customText}
                      onChange={(e) => setCustomText(i, e.target.value)}
                      placeholder="например: в кармане куртки"
                    />
                  )}
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
            <button className="link-btn safe-code-generate-btn" onClick={generateRandom}>
              🎲 Сгенерировать случайные
            </button>
          </div>
        </div>

        <div className="params-start-phone">
          <Button fullWidth onClick={startSession} disabled={!isReady}>Начать занятие</Button>
        </div>
      </div>
    </div>
  );
}
