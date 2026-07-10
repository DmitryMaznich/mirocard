import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { useTimer } from "@/features/timer/TimerContext";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import { getInitials } from "@/shared/utils/format";
import { getSafeCodeCustomLocations, saveSafeCodeCustomLocations, saveSafeCodeConfig } from "@/core/groupStore";

const MIN_CODE_LENGTH = 2;
const MAX_CODE_LENGTH = 5;
const PLACE_DATALIST_ID = "safe-code-saved-places";
const SPOT_DATALIST_ID = "safe-code-saved-spots";

function emptyRow() {
  return { place: "", phrase: "", digit: "" };
}

function uniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))];
}

function randomDigits(count) {
  const pool = Array.from({ length: 10 }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function printDigitCards() {
  const cells = Array.from({ length: 10 }, (_, i) => `<div class="cell"><span class="digit">${i}</span></div>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Карточки с цифрами</title><style>
@page{size:A4;margin:5mm}
*{box-sizing:border-box}
html,body{height:100%;margin:0;padding:0}
.grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(5,1fr);width:100%;height:100%}
.cell{display:flex;align-items:center;justify-content:center;border:1px dashed #999;overflow:hidden}
.digit{font-family:Arial,Helvetica,sans-serif;font-size:120pt;font-weight:900;color:#111;line-height:1}
</style></head><body>
<div class="grid">${cells}</div>
</body></html>`;
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;width:0;height:0;opacity:0;border:none";
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  setTimeout(() => document.body.removeChild(iframe), 2000);
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

  function updateSavedLocation(index, patch) {
    setCustomLocations((prev) => prev.map((loc, i) => (i === index ? { ...loc, ...patch } : loc)));
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

  const isReady = rows.length === codeLength && rows.every((row) => row.place.trim() && row.phrase.trim() && row.digit !== "");

  async function startSession() {
    const typedRows = rows
      .map((row) => ({ place: row.place.trim(), phrase: row.phrase.trim() }))
      .filter((row) => row.place && row.phrase);
    const newOnes = typedRows.filter(
      (row) => !customLocations.some((c) => c.place === row.place && c.phrase === row.phrase)
    );
    if (newOnes.length) {
      const merged = [...customLocations, ...newOnes];
      setCustomLocations(merged);
      await saveSafeCodeCustomLocations(topicId, merged).catch(() => {});
    }
    await saveSafeCodeConfig(topicId, {
      codeLength,
      locations: rows.map((row) => ({ place: row.place, phrase: row.phrase, digit: Number(row.digit) })),
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

          <div className="param-row">
            <button type="button" className="link-btn safe-code-print-btn" onClick={printDigitCards}>
              🖨 Распечатать карточки с цифрами (0–9)
            </button>
          </div>

          <div className="param-row param-row--block">
            <div className="param-label">Где спрятаны цифры</div>
            <div className="safe-code-rows">
              {rows.map((row, i) => (
                <div key={i} className="safe-code-row">
                  <span className="safe-code-row-index">{i + 1}.</span>
                  <span className="safe-code-row-verb">Иди</span>
                  <input
                    className="safe-code-location-input"
                    list={PLACE_DATALIST_ID}
                    value={row.place}
                    onChange={(e) => updateRow(i, { place: e.target.value })}
                    placeholder="куда: в свою комнату"
                  />
                  <span className="safe-code-row-verb">и найди</span>
                  <input
                    className="safe-code-location-input"
                    list={SPOT_DATALIST_ID}
                    value={row.phrase}
                    onChange={(e) => updateRow(i, { phrase: e.target.value })}
                    placeholder="где: под подушкой"
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
            <datalist id={PLACE_DATALIST_ID}>
              {uniqueValues(customLocations, "place").map((place) => <option key={place} value={place} />)}
            </datalist>
            <datalist id={SPOT_DATALIST_ID}>
              {uniqueValues(customLocations, "phrase").map((phrase) => <option key={phrase} value={phrase} />)}
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
                  value={loc.place}
                  onChange={(e) => updateSavedLocation(i, { place: e.target.value })}
                  onBlur={persistSavedLocations}
                  placeholder="куда идти"
                />
                <input
                  className="safe-code-manage-input"
                  value={loc.phrase}
                  onChange={(e) => updateSavedLocation(i, { phrase: e.target.value })}
                  onBlur={persistSavedLocations}
                  placeholder="где искать"
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
