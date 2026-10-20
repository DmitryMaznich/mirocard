export async function sha256Bytes(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, "0")).join("");
}

export function downloadParts(entry) {
  return [entry.languageDownload?.core, ...Object.values(entry.languageDownload?.languages ?? {})].filter(Boolean);
}

export function withoutDownloadUrls(entry) {
  const { url, zipUrl, ...rest } = entry;
  void url; void zipUrl;
  if (!entry.languageDownload) return rest;
  const strip = ({ url: ignored, ...part }) => { void ignored; return part; };
  return { ...rest, languageDownload: { ...entry.languageDownload,
    core: strip(entry.languageDownload.core),
    languages: Object.fromEntries(Object.entries(entry.languageDownload.languages).map(([code, part]) => [code, strip(part)])),
  } };
}

export function topicDownloadDescriptor(record) {
  const delivery = record?.languageContract?.delivery;
  if (!delivery) return null;
  return { schemaVersion: 1,
    core: { url: delivery.coreUrl, version: record.meta.version, bytes: record.installation?.coreBytes, sha256: record.installation?.coreSha256 },
    languages: Object.fromEntries(Object.entries(record.languageContract.packages).map(([language, pack]) => [language, { ...pack.download, language, packageId: pack.packageId, version: pack.version, modeIds: pack.modeIds, audio: pack.audio, ...(pack.audioScope ? { audioScope: pack.audioScope } : {}) }])),
  };
}

export function nativeLanguageName(code) {
  return ({ ru: "Русский", sl: "Slovenščina", en: "English" })[code] ?? code;
}

export function hasInstalledPackage(record, language, part) {
  const pack = record?.languageResources?.content?.[language];
  if (!pack) return false;
  if (!part) return true; // Legacy, already installed monolithic archive.
  return pack.packageId === part.packageId && pack.version === part.version
    && record.installation?.packages?.[language]?.sha256 === part.sha256;
}

export function remainingDownloadBytes(record, delivery, language) {
  if (!delivery) return 0;
  const part = delivery.languages[language];
  if (!part) return null;
  const coreReady = record?.meta.version === delivery.core.version && record.installation?.coreSha256 === delivery.core.sha256;
  return (coreReady ? 0 : delivery.core.bytes ?? 0) + (hasInstalledPackage(record, language, part) ? 0 : part.bytes);
}
