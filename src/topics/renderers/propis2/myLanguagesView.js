// No imports: the app store (src/core/store.js) applies this to every topic record.
// The topic record as the app shows it with «Мои языки» (the store applies it to every record with `meta.myLanguages`, store.js): a mode
// that needs a language (`mode.requiresLanguages`: the dictation — recorded in Russian only) is left out when none of mine has it, and a
// mode's language (`params.writingLang`) offers only mine. Always made from the deck's own modes (`allModes`), never from a shown copy.
export function withMyLanguages(record, myIds) {
  if (!record?.meta?.myLanguages || !Array.isArray(myIds) || !myIds.length) return record;
  const base = record.allModes ?? record.modes ?? [];
  const modes = base
    .filter((m) => !Array.isArray(m.requiresLanguages) || m.requiresLanguages.some((id) => myIds.includes(id)))
    .map((m) => {
      const wl = m.params?.writingLang;
      if (!wl || !Array.isArray(wl.values)) return m;
      const values = wl.values.filter((v) => myIds.includes(v));
      if (!values.length) return m;
      return { ...m, params: { ...m.params, writingLang: { ...wl, values, default: values.includes(wl.default) ? wl.default : values[0], ...(values.length < 2 ? { hidden: true } : {}) } } };
    });
  return { ...record, allModes: base, modes };
}
