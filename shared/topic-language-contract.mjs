// Opt-in contract. This module deliberately has no application/store/UI imports.
const fail = (message) => { throw new Error(`Topic language contract: ${message}`); };
const placeholders = (text) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(",");
const safePath = (path) => typeof path === "string" && /^[\w/-]+\.json$/.test(path) && !path.split("/").includes("..");

function messageMap(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length) fail(`${name}: empty messages`);
  for (const [key, text] of Object.entries(value)) {
    if (!/^[\w.-]+$/.test(key) || typeof text !== "string" || !text.trim()) fail(`${name}: invalid message ${key}`);
  }
}

export function validateTopicLanguages(topic) {
  const contract = topic.languageContract;
  if (!contract) return topic;
  if (contract.schemaVersion !== 1) fail("unsupported schemaVersion");
  const ui = topic.languageResources?.ui;
  const content = topic.languageResources?.content;
  if (!ui || !content || !contract.ui?.ru || !contract.ui?.sl) fail("RU/SL UI resources are required");
  let keys;
  for (const language of Object.keys(contract.ui)) {
    if (!safePath(contract.ui[language])) fail(`unsafe UI path: ${language}`);
    messageMap(ui[language], `UI ${language}`);
    const nextKeys = Object.keys(ui[language]).sort();
    if (keys && JSON.stringify(keys) !== JSON.stringify(nextKeys)) fail(`UI key mismatch: ${language}`);
    keys = nextKeys;
    for (const key of keys) {
      if (placeholders(ui[language][key]) !== placeholders(ui.ru[key])) fail(`UI placeholders: ${language}/${key}`);
    }
  }
  if (!Object.keys(contract.packages ?? {}).length) fail("no content packages");
  const modes = topic.modes ?? [];
  for (const [language, descriptor] of Object.entries(contract.packages)) {
    const pack = content[language];
    if (!safePath(descriptor.file)) fail(`unsafe content path: ${language}`);
    if (!pack || pack.schemaVersion !== 1 || pack.language !== language || pack.packageId !== descriptor.packageId || pack.version !== descriptor.version) fail(`package identity mismatch: ${language}`);
    if (!descriptor.packageId || !/^\d+\.\d+\.\d+$/.test(descriptor.version)) fail(`invalid package version: ${language}`);
    // Version 1 is intentionally text/neutral graphics only. Recorded speech needs
    // a separate resource contract; it must never borrow another language's audio.
    if (descriptor.audio !== "none" || pack.audio !== "none") fail(`unsupported speech capability: ${language}`);
    messageMap(pack.messages, `content ${language}`);
    if (!descriptor.modeIds?.length || descriptor.modeIds.some((id) => !modes.some((m) => m.id === id))) fail(`invalid mode availability: ${language}`);
    for (const modeId of descriptor.modeIds) {
      const mode = modes.find((m) => m.id === modeId);
      if (!mode.contentKeys?.length) fail(`missing contentKeys: ${modeId}`);
      for (const key of mode.contentKeys) {
        if (!Object.hasOwn(pack.messages, key)) fail(`missing content: ${language}/${modeId}/${key}`);
        for (const [otherLanguage, other] of Object.entries(contract.packages)) {
          if (other.modeIds?.includes(modeId) && content[otherLanguage]?.messages?.[key] && placeholders(pack.messages[key]) !== placeholders(content[otherLanguage].messages[key])) fail(`content placeholders: ${language}/${key}`);
        }
      }
    }
  }
  for (const mode of modes) {
    const controls = Object.values(mode.params ?? {}).filter((def) => def.type === "content_language");
    if (controls.length !== 1) fail(`one content_language control required: ${mode.id}`);
    const available = Object.entries(contract.packages).filter(([, p]) => p.modeIds.includes(mode.id)).map(([language]) => language).sort();
    if (!available.length || JSON.stringify([...controls[0].values].sort()) !== JSON.stringify(available)) fail(`language options mismatch: ${mode.id}`);
  }
  return topic;
}

export async function loadTopicLanguages(manifest, readText) {
  if (!manifest.languageContract) return manifest;
  const contract = manifest.languageContract;
  if (contract.schemaVersion !== 1 || !contract.ui || !contract.packages) fail("invalid contract");
  const read = async (path) => {
    if (!safePath(path)) fail(`unsafe resource path: ${path}`);
    const text = await readText(path);
    if (text == null) fail(`missing file: ${path}`);
    return JSON.parse(text);
  };
  const ui = Object.create(null), content = Object.create(null);
  for (const [language, path] of Object.entries(contract.ui)) ui[language] = await read(path);
  for (const [language, pack] of Object.entries(contract.packages)) content[language] = await read(pack.file);
  const topic = validateTopicLanguages({ ...manifest, languageResources: { ui, content } });
  const localized = (key) => Object.fromEntries(Object.entries(ui).map(([language, messages]) => {
    if (!Object.hasOwn(messages, key)) fail(`missing UI: ${language}/${key}`);
    return [language, messages[key]];
  }));
  // Only presentation fields are hydrated; IDs, values and lesson data are never translated.
  return {
    ...topic,
    meta: { ...topic.meta, title: localized("topic.title"), description: localized("topic.description") },
    modes: topic.modes.map((mode) => ({
      ...mode,
      ui: { ...mode.ui, title: localized(`${mode.id}.title`) },
      methodology: { text: localized(`${mode.id}.methodology`), settings: [localized(`${mode.id}.settings`)], uiLocalized: true },
      params: Object.fromEntries(Object.entries(mode.params).map(([key, def]) => [key, {
        ...def,
        label: localized(`${mode.id}.params.${key}.label`),
        ...(def.type === "enum" || def.type === "content_language" ? {
          labels: Object.fromEntries(Object.keys(ui).map((language) => [language, Object.fromEntries(def.values.map((value) => {
            const messageKey = `${mode.id}.params.${key}.option.${value}`;
            return [value, localized(messageKey)[language]];
          }))])),
        } : {}),
      }])),
    })),
  };
}

export function contentLanguageParam(mode) {
  return Object.entries(mode?.params ?? {}).find(([, def]) => def.type === "content_language")?.[0];
}

export function availableContentLanguages(topic, modeId) {
  return Object.entries(topic?.languageContract?.packages ?? {}).filter(([language, pack]) => pack.modeIds.includes(modeId) && topic.languageResources?.content?.[language]).map(([language]) => language);
}

export function initialContentLanguage(topic, modeId, ...preferences) {
  const preferred = preferences.find((language) => typeof language === "string" && language.length);
  return availableContentLanguages(topic, modeId).includes(preferred) ? preferred : null;
}

export function createContentContext(topic, mode, params) {
  validateTopicLanguages(topic);
  const language = params[contentLanguageParam(mode)];
  if (!availableContentLanguages(topic, mode.id).includes(language)) fail(`content language unavailable: ${language ?? "not selected"}`);
  const descriptor = topic.languageContract.packages[language];
  const pack = topic.languageResources.content[language];
  if (pack.language !== language || pack.version !== descriptor.version || pack.packageId !== descriptor.packageId) fail("stale content package");
  return Object.freeze({ contractVersion: 1, topicId: topic.meta.id, modeId: mode.id, contentLanguage: language, packageId: descriptor.packageId, contentVersion: descriptor.version, audio: descriptor.audio });
}

export function contentMessage(pack, key, values = {}) {
  const message = pack?.messages?.[key];
  if (typeof message !== "string") fail(`missing content message: ${key}`);
  return message.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    if (!Object.hasOwn(values, name)) fail(`missing placeholder: ${key}/${name}`);
    return String(values[name]);
  });
}
