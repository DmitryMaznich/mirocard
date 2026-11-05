import { normalizeLessonFlow } from "../../../shared/lesson-flow.mjs";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";

export default function LessonFlowSettings({ value, onChange }) {
  const { t } = useUiTranslation();
  const flow = normalizeLessonFlow(value);
  return <fieldset className="lesson-flow-settings">
    <legend>{t("flow.title")}</legend>
    <div className="reward-settings__choices" role="group" aria-label={t("flow.title")}>
      {["tap", "auto"].map(advance => <button key={advance} type="button" aria-pressed={flow.advance === advance}
        onClick={() => onChange({ ...flow, advance })}>{t(`flow.${advance}`)}</button>)}
    </div>
    {flow.advance === "auto" && <label className="settings-row">{t("flow.delay")}
      <select aria-label={t("flow.delay")} value={flow.delaySeconds} onChange={e => onChange({ ...flow, delaySeconds: Number(e.target.value) })}>
        {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select>
    </label>}
    <p>{t("flow.scope")}</p>
  </fieldset>;
}
