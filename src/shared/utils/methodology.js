import { getTopicTitle } from "@/shared/utils/format";

function getLocalizedText(value) {
  return getTopicTitle(value);
}

function toTextList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(getLocalizedText).filter(Boolean);
  }
  const text = getLocalizedText(value);
  return text ? [text] : [];
}

function getValueLabel(def, value) {
  const labels = def?.labels?.ru ?? def?.labels ?? {};
  return getLocalizedText(labels?.[value]) || String(value);
}

export function buildModeSettings(mode) {
  const explicitSettings = toTextList(mode?.methodology?.settings);
  if (explicitSettings.length > 0) return explicitSettings;

  const params = mode?.params ?? {};
  const rows = Object.entries(params)
    .filter(([, def]) => def?.type !== "concept_selector")
    .map(([key, def]) => {
      const label = getLocalizedText(def?.label) || key;
      const hint = getLocalizedText(def?.hint);

      if (def?.type === "enum") {
        const values = (def.values ?? []).map((value) => getValueLabel(def, value)).join(" / ");
        const defaultText = def.default != null ? ` По умолчанию: ${getValueLabel(def, def.default)}.` : "";
        return `${label}: ${values || "варианты выбираются в настройках"}.${defaultText}${hint ? ` ${hint}` : ""}`;
      }

      if (def?.type === "number") {
        const range = [def.min, def.max].filter((v) => v != null).join("-");
        const defaultText = def.default != null ? ` По умолчанию: ${def.default}.` : "";
        return `${label}: ${range ? `диапазон ${range}` : "числовое значение"}.${defaultText}${hint ? ` ${hint}` : ""}`;
      }

      if (def?.type === "boolean") {
        const defaultText = def.default != null ? ` По умолчанию: ${def.default ? "включено" : "выключено"}.` : "";
        return `${label}: включить или выключить.${defaultText}${hint ? ` ${hint}` : ""}`;
      }

      return `${label}: настройка режима.`;
    });

  return rows.length > 0
    ? rows
    : ["Дополнительных настроек нет: логопед работает в базовом сценарии режима."];
}

export function getModeGoal(mode) {
  return getLocalizedText(mode?.methodology?.goal ?? mode?.methodology?.finalGoal);
}

export function getModeSummary(mode) {
  return (
    getLocalizedText(mode?.methodology?.summary)
    || getLocalizedText(mode?.methodology?.text)
    || getLocalizedText(mode?.ui?.instruction)
  );
}
