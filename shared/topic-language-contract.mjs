// Opt-in contract. This module deliberately has no application/store/UI imports.
const fail = (message) => { throw new Error(`Topic language contract: ${message}`); };
const placeholders = (text) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(",");
const safePath = (path) => typeof path === "string" && /^[\w-]+(?:\/[\w-]+)*\.json$/.test(path);

function messageMap(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length) fail(`${name}: empty messages`);
  for (const [key, text] of Object.entries(value)) {
    if (!/^[\w.-]+$/.test(key) || typeof text !== "string" || !text.trim()) fail(`${name}: invalid message ${key}`);
  }
}

export function validateTopicLanguages(topic, { requireAllContent = true } = {}) {
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
  if (contract.delivery && (contract.delivery.version !== 1 || contract.selectionScope !== "topic" || !/^\.\/decks\/[\w./-]+\.zip$/.test(contract.delivery.coreUrl) || contract.delivery.coreUrl.split("/").includes(".."))) fail("invalid delivery contract");
  const modes = topic.modes ?? [];
  for (const [language, descriptor] of Object.entries(contract.packages)) {
    const pack = content[language];
    if (!descriptor.packageId || !/^\d+\.\d+\.\d+$/.test(descriptor.version)) fail(`invalid package version: ${language}`);
    if (!descriptor.modeIds?.length || descriptor.modeIds.some((id) => !modes.some((m) => m.id === id))) fail(`invalid mode availability: ${language}`);
    if (contract.delivery && (!/^\.\/decks\/[\w./-]+\.zip$/.test(descriptor.download?.url) || descriptor.download.url.split("/").includes("..") || !Number.isSafeInteger(descriptor.download.bytes) || descriptor.download.bytes < 1 || !/^[a-f0-9]{64}$/.test(descriptor.download.sha256))) fail(`invalid download descriptor: ${language}`);
    if (!safePath(descriptor.file)) fail(`unsafe content path: ${language}`);
    if (!pack && !requireAllContent) continue;
    if (!pack || pack.schemaVersion !== 1 || pack.language !== language || pack.packageId !== descriptor.packageId || pack.version !== descriptor.version) fail(`package identity mismatch: ${language}`);
    if (!descriptor.packageId || !/^\d+\.\d+\.\d+$/.test(descriptor.version)) fail(`invalid package version: ${language}`);
    // Speech and every recording belong to the explicitly selected package.
    if (descriptor.audio !== pack.audio || !["none", ...(contract.delivery ? ["recorded"] : [])].includes(pack.audio)) fail(`unsupported speech capability: ${language}`);
    const assets = pack.assets ?? [];
    if (!Array.isArray(assets) || new Set(assets.map((a) => a.path)).size !== assets.length) fail(`invalid assets: ${language}`);
    for (const asset of assets) {
      if (!asset.path?.startsWith(`content/${language}/${pack.version}/`) || asset.path.split("/").some((part) => !part || part === "." || part === "..") || !/^[\w./-]+$/.test(asset.path) || !["image", "audio"].includes(asset.kind) || !Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || !/^[a-f0-9]{64}$/.test(asset.sha256)) fail(`invalid asset: ${language}/${asset.path}`);
    }
    if ((pack.audio === "recorded") !== assets.some((a) => a.kind === "audio")) fail(`audio assets mismatch: ${language}`);
    messageMap(pack.messages, `content ${language}`);
    if (descriptor.audioScope !== pack.audioScope || (pack.audioScope != null && (pack.audio !== "recorded" || pack.audioScope !== "feedback"))) fail(`invalid audio scope: ${language}`);
    for (const [key, path] of Object.entries(pack.recordings ?? {})) {
      if (!Object.hasOwn(pack.messages, key) || !assets.some((asset) => asset.kind === "audio" && asset.path === path)) fail(`invalid recording: ${language}/${key}`);
    }
    if (pack.audioScope === "feedback" && !Object.keys(pack.recordings ?? {}).length) fail(`missing feedback recordings: ${language}`);
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
    if (contract.selectionScope === "topic") {
      if (controls.length) fail(`topic language must not be a mode control: ${mode.id}`);
      if (!Object.values(contract.packages).some((p) => p.modeIds.includes(mode.id))) fail(`no package for mode: ${mode.id}`);
      continue;
    }
    if (controls.length !== 1) fail(`one content_language control required: ${mode.id}`);
    const available = Object.entries(contract.packages).filter(([, p]) => p.modeIds.includes(mode.id)).map(([language]) => language).sort();
    if (!available.length || JSON.stringify([...controls[0].values].sort()) !== JSON.stringify(available)) fail(`language options mismatch: ${mode.id}`);
  }
  return topic;
}

export async function loadTopicLanguages(manifest, readText, { allowMissingContent = false, installedContent = {} } = {}) {
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
  for (const [language, pack] of Object.entries(contract.packages)) {
    if (!safePath(pack.file)) fail(`unsafe resource path: ${pack.file}`);
    const text = await readText(pack.file);
    if (text != null) content[language] = JSON.parse(text);
    else if (installedContent[language]?.packageId === pack.packageId && installedContent[language]?.version === pack.version) content[language] = installedContent[language];
    else if (!allowMissingContent) fail(`missing file: ${pack.file}`);
  }
  const topic = validateTopicLanguages({ ...manifest, languageResources: { ui, content } }, { requireAllContent: !allowMissingContent });
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
  validateTopicLanguages(topic, { requireAllContent: false });
  const language = params.contentLanguage ?? params[contentLanguageParam(mode)];
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

// Topic choice belongs to the student-topic link, never the global UI locale.
// Conflicting legacy per-mode choices require an explicit one-time selection.
export function selectedTopicLanguage(topic, params = {}, ...preferences) {
  const declared = topic?.languageContract?.packages ?? {};
  if (params.topicContentLanguage) return Object.hasOwn(declared, params.topicContentLanguage) ? params.topicContentLanguage : null;
  const legacy = [...new Set([params.contentLanguage, ...Object.values(params.byMode ?? {}).map((p) => p.contentLanguage)].filter(Boolean))];
  if (legacy.length > 1) return null;
  const language = legacy[0] ?? preferences.find((value) => typeof value === "string" && value);
  return Object.hasOwn(declared, language) ? language : null;
}
