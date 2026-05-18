import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";
import { getVoiceEngineId } from "@/shared/hooks/useSpeech";

// Convert a TTS engine ID to a human-readable label.
// engineId is typically a package name (Android) or a short brand string (desktop/iOS).
function engineLabel(engineId, sampleVoiceName = "") {
  const s = (engineId + " " + sampleVoiceName).toLowerCase();
  if (s.includes("google")) return "Google TTS";
  if (s.includes("samsung")) return "Samsung TTS";
  if (s.includes("apple")) return "Apple TTS";
  if (s.includes("microsoft")) return "Microsoft TTS";
  if (s.includes("nuance")) return "Nuance TTS";
  if (s.includes("ivona")) return "IVONA TTS";
  // Fallback: pick the most meaningful dot-segment
  const parts = engineId.split(/[.\-_:]/);
  const skip = new Set(["com", "org", "net", "android", "voice", "tts", "speech"]);
  const meaningful = parts.find((p) => p.length > 2 && !skip.has(p));
  if (meaningful) return meaningful[0].toUpperCase() + meaningful.slice(1) + " TTS";
  return engineId;
}

function fakeSession(pct, studentId, topicId) {
  const total = 10;
  const correct = Math.round(total * pct / 100);
  return {
    id: "dev_" + Date.now(),
    studentId: studentId ?? "dev",
    topicId:   topicId   ?? "dev",
    topicVersion: "1.0.0",
    modeId:    "yes_no",
    conceptIds: [],
    startedAt:   new Date().toISOString(),
    completedAt: new Date().toISOString(),
    correctCount:   correct,
    incorrectCount: total - correct,
    percentCorrect: pct,
    mistakes: [],
  };
}

export default function SettingsScreen() {
  const setScreen        = useAppStore((s) => s.setScreen);
  const account          = useAppStore((s) => s.account);
  const buildInfo        = useAppStore((s) => s.buildInfo);
  const logout           = useAppStore((s) => s.logout);
  const appendSession    = useAppStore((s) => s.appendSession);
  const activeStudentId  = useAppStore((s) => s.activeStudentId);
  const activeTopicId    = useAppStore((s) => s.activeTopicId);
  const settings         = useAppStore((s) => s.settings);
  const patchSettings    = useAppStore((s) => s.patchSettings);

  const adultConfirmAdvance = settings.adultConfirmAdvance ?? true;
  const tapToAdvance     = settings.tapToAdvance ?? true;
  const requiresTapToAdvance = adultConfirmAdvance || tapToAdvance;
  const autoAdvanceDelay = settings.autoAdvanceDelay ?? 3;

  async function handlePatchSettings(patch) {
    patchSettings(patch);
    const db = await getDb();
    await kv.set(db, "settings", { ...settings, ...patch });
  }

  function testSummary(pct) {
    appendSession(fakeSession(pct, activeStudentId, activeTopicId));
    setScreen("summary");
  }

  const [confirmLogout, setConfirmLogout] = useState(false);

  // Load all voices (Chrome on Android fires voiceschanged asynchronously)
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    function load() {
      const list = window.speechSynthesis?.getVoices() ?? [];
      if (list.length > 0) setVoices(Array.from(list));
    }
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  // Group voices by engine, keep only unique engines
  const engines = useMemo(() => {
    const seen = new Map(); // engineId → label
    for (const v of voices) {
      const id = getVoiceEngineId(v);
      if (!seen.has(id)) seen.set(id, engineLabel(id, v.name));
    }
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  }, [voices]);

  function testEngine() {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utt = new SpeechSynthesisUtterance("Привет! Это тестовое сообщение.");
    utt.rate = 0.88;
    const engineId = settings.ttsEngine ?? "";
    if (engineId) {
      const v = voices.find((v) => getVoiceEngineId(v) === engineId && v.lang.startsWith("ru"))
             ?? voices.find((v) => getVoiceEngineId(v) === engineId);
      if (v) { utt.voice = v; utt.lang = v.lang; }
    } else {
      utt.lang = "ru-RU";
      const ru = voices.find((v) => v.lang.startsWith("ru"));
      if (ru) utt.voice = ru;
    }
    synth.speak(utt);
  }

  async function handleLogout() {
    try { await api.post("/auth/logout"); } catch {
      // Local logout should still proceed when the network request fails.
    }
    const db = await getDb();
    await kv.del(db, "token");
    await kv.del(db, "account");
    logout();
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}>←</button>
        <h1 className="screen-title">Настройки</h1>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-section-title">Аккаунт</div>
          <div className="settings-row">
            <div className="settings-row__label">Email</div>
            <div className="settings-row__value">{account?.email ?? "—"}</div>
          </div>
          <div className="settings-row">
            <div className="settings-row__label">Имя</div>
            <div className="settings-row__value">{account?.displayName ?? "—"}</div>
          </div>
        </div>

        <div className="settings-section">
          {!confirmLogout ? (
            <button className="settings-danger-btn" onClick={() => setConfirmLogout(true)}>
              Выйти из аккаунта
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, padding: 12 }}>
              <Button variant="secondary" onClick={() => setConfirmLogout(false)}>Отмена</Button>
              <Button variant="danger" onClick={handleLogout}>Выйти</Button>
            </div>
          )}
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Темп продолжения</div>
          <div
            className="settings-row"
            style={{ cursor: "pointer" }}
            onClick={() => handlePatchSettings({ adultConfirmAdvance: !adultConfirmAdvance })}
          >
            <span className="settings-row__label">Переход после подтверждения</span>
            <input
              type="checkbox"
              checked={adultConfirmAdvance}
              readOnly
              style={{ width: 18, height: 18, accentColor: "var(--color-primary, #5b8def)", flexShrink: 0, cursor: "pointer" }}
            />
          </div>
          <div
            className="settings-row"
            style={{ cursor: adultConfirmAdvance ? "default" : "pointer", opacity: adultConfirmAdvance ? 0.55 : 1 }}
            onClick={() => {
              if (!adultConfirmAdvance) handlePatchSettings({ tapToAdvance: !tapToAdvance });
            }}
          >
            <span className="settings-row__label">Следующая карта по тапу</span>
            <input
              type="checkbox"
              checked={adultConfirmAdvance ? true : tapToAdvance}
              readOnly
              disabled={adultConfirmAdvance}
              style={{ width: 18, height: 18, accentColor: "var(--color-primary, #5b8def)", flexShrink: 0, cursor: "pointer" }}
            />
          </div>
          <div
            className="settings-row"
            style={{ opacity: requiresTapToAdvance ? 0.4 : 1, pointerEvents: requiresTapToAdvance ? "none" : "auto" }}
          >
            <div className="settings-row__label">Задержка (сек)</div>
            <div className="param-stepper">
              <button
                className="stepper-btn"
                disabled={autoAdvanceDelay <= 1}
                onClick={() => handlePatchSettings({ autoAdvanceDelay: autoAdvanceDelay - 1 })}
              >−</button>
              <span className="stepper-value">{autoAdvanceDelay}</span>
              <button
                className="stepper-btn"
                disabled={autoAdvanceDelay >= 10}
                onClick={() => handlePatchSettings({ autoAdvanceDelay: autoAdvanceDelay + 1 })}
              >+</button>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Синтез речи (TTS)</div>
          <div className="settings-row settings-row--col">
            <span className="settings-row__label">Движок</span>
            <div className="settings-voice-row">
              <select
                className="settings-voice-select"
                value={settings.ttsEngine ?? ""}
                onChange={(e) => handlePatchSettings({ ttsEngine: e.target.value })}
              >
                <option value="">По умолчанию (устройство)</option>
                {engines.map(({ id, label }) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
              <button className="settings-voice-test-btn" onClick={testEngine} title="Проверить">
                ▶
              </button>
            </div>
            {voices.length === 0 && (
              <span className="settings-voice-hint">Голоса не обнаружены или загружаются…</span>
            )}
          </div>
        </div>
      </div>

      <div className="settings-section" style={{ borderTop: "1px dashed #ddd", marginTop: 8 }}>
        <div className="settings-section-title" style={{ color: "#bbb" }}>Dev · тест экрана завершения</div>
        <div style={{ display: "flex", gap: 8, padding: "8px 12px", flexWrap: "wrap" }}>
          {[100, 90, 75, 50, 30].map((pct) => (
            <button
              key={pct}
              onClick={() => testSummary(pct)}
              style={{
                padding: "6px 14px", borderRadius: 10, border: "1px solid #ddd",
                background: "#f5f5f5", fontSize: 14, cursor: "pointer",
              }}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      <div className="settings-build-info">
        v{buildInfo.version} · {buildInfo.gitSha}
      </div>
    </div>
  );
}
