import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { normalizeRewardSettings } from "../../../shared/reward-policy.mjs";
import { rewardText as text } from "./rewardText.js";
import "./rewards.css";

export default function RewardSettingsSection({ value, onChange }) {
  useUiTranslation();
  const settings = normalizeRewardSettings(value);
  const flexible = settings.algorithm === "flexible";
  const change = patch => onChange({ ...settings, ...patch });
  return <section className="reward-settings" aria-label={text("title")}>
    <h3>{text("title")}</h3>
    <p>{text("rollout")}</p>
    <div className="reward-settings__choices" role="group" aria-label={text("title")}>
      {["legacy", "flexible"].map(algorithm => <button type="button" key={algorithm}
        aria-pressed={settings.algorithm === algorithm} onClick={() => change({ algorithm })}>{text(algorithm)}</button>)}
    </div>
    <p className="reward-settings__notice">{flexible ? text("rollback") : text("legacyHint")}</p>
    <fieldset disabled={!flexible}>
      <legend>{text("duration")}</legend>
      <div className="reward-settings__choices reward-settings__choices--wrap">
        {[["60", "minute"], ["120", "two"], ["180", "three"]].map(([duration, label]) =>
          <button type="button" key={duration} aria-pressed={settings.duration === duration} onClick={() => change({ duration })}>{text(label)}</button>)}
      </div>
      <p>{text("timing")}</p>
      <p>{text("scope")}</p>
      <label className="reward-settings__check"><input type="checkbox" checked={settings.strictStars}
        onChange={event => change({ strictStars: event.target.checked })} />{text("strict")}</label>
      <p>{text("strictInfo")}</p>
      <RewardLossControl value={settings.lossMode} onChange={lossMode => change({ lossMode })} />
      <h4>{text("animation")}</h4>
      <div className="reward-settings__choices">
        {["soft", "normal"].map(animation => <button type="button" key={animation}
          aria-pressed={settings.animation === animation} onClick={() => change({ animation })}>{text(animation)}</button>)}
      </div>
      <label className="reward-settings__check"><input type="checkbox" checked={settings.sound}
        onChange={event => change({ sound: event.target.checked })} />{text("sound")}</label>
    </fieldset>
  </section>;
}

export function RewardLossControl({ value, onChange, disabled }) {
  useUiTranslation();
  return <div className="reward-settings">
    <h4>{text("loss")}</h4>
    <div className="reward-settings__choices" role="group" aria-label={text("loss")}>
      {["one", "all"].map(loss => <button type="button" key={loss} disabled={disabled}
        aria-pressed={value === loss} onClick={() => onChange(loss)}>{text(loss)}</button>)}
    </div>
    <p className="reward-settings__notice">{text("attempt")}</p>
  </div>;
}

export function RewardRulesSummary({ settings }) {
  useUiTranslation();
  return <div className="reward-settings" aria-label={text("title")}>
    <p className="reward-settings__notice">{text("scope")} {text("editProfile")}</p>
    <p>{text("strict")}: <strong>{text(settings.strictStars ? "on" : "off")}</strong></p>
    <p>{text("loss")}: <strong>{text(settings.lossMode === "all" ? "all" : "one")}</strong></p>
  </div>;
}
