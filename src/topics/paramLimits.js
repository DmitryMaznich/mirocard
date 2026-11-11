// Settings that depend on each other. An enum param declares
// `limitBy: "<other param>"`: its values above the other param's current value
// are not offered, and a saved value that is no longer allowed becomes the
// largest allowed one. `anyValue` is the "любое" sentinel (e.g. 99): offered
// only when the limit is above every ordinary value, otherwise it would mean
// the same as the largest ordinary one.
// «Плюс и минус»: «Максимальное изменение» is limited by «Максимальное число» —
// with numbers up to 5 a change «до 10» or «любое» makes no sense.

function currentValue(key, params, modeParams) {
  return params?.[key] ?? modeParams?.[key]?.default;
}

export function allowedEnumValues(def, params, modeParams) {
  const values = def?.values ?? [];
  if (!def?.limitBy) return values;
  const limit = Number(currentValue(def.limitBy, params, modeParams));
  if (!Number.isFinite(limit)) return values;
  const ordinary = values.filter((v) => v !== def.anyValue);
  const allowed = ordinary.filter((v) => Number(v) <= limit);
  const anyAllowed = def.anyValue != null && values.includes(def.anyValue)
    && ordinary.every((v) => Number(v) < limit);
  const result = anyAllowed ? [...allowed, def.anyValue] : allowed;
  return result.length ? result : ordinary.slice(0, 1);
}

function clampValue(def, value, allowed) {
  if (allowed.includes(value)) return value;
  const ordinary = allowed.filter((v) => v !== def.anyValue);
  if (value === def.anyValue || value == null) return ordinary.at(-1) ?? allowed[0];
  const below = ordinary.filter((v) => Number(v) <= Number(value));
  return below.at(-1) ?? ordinary[0] ?? allowed[0];
}

// Returns `params` itself when nothing had to change, so it is safe in effects.
export function applyParamLimits(modeParams, params) {
  let next = params;
  for (const [key, def] of Object.entries(modeParams ?? {})) {
    if (def?.type !== "enum" || !def.limitBy) continue;
    const value = currentValue(key, next, modeParams);
    const allowed = allowedEnumValues(def, next, modeParams);
    const clamped = clampValue(def, value, allowed);
    if (clamped !== value) next = { ...next, [key]: clamped };
  }
  return next;
}
