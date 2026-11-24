import { describe, it, expect } from "vitest";
import { getBuiltinTopicAsset, localizedAssetSvg } from "./builtinAssets.js";

const decode = (url) => decodeURIComponent(url.replace("data:image/svg+xml;charset=utf-8,", ""));

describe("covers drawn per interface language («Прописи», 2026-11-24)", () => {
  const ru = localizedAssetSvg("media/avatar_propis.svg", "ru");
  const sl = localizedAssetSvg("media/avatar_propis.svg", "sl");
  const en = localizedAssetSvg("media/avatar_propis.svg", "en");

  it("Russian is the base asset; Slovenian and English have their own pictures", () => {
    expect(ru).toBeTruthy();
    expect(new Set([ru, sl, en]).size).toBe(3);
    expect(localizedAssetSvg("media/avatar_propis.svg", null)).toBe(ru);
  });

  it("a code the interface does not know is the source language, Russian (shared/ui-languages.mjs uiFallbackChain)", () => {
    expect(localizedAssetSvg("media/avatar_propis.svg", "de")).toBe(ru);
  });

  it("a cover without language versions is the same in every language", () => {
    expect(localizedAssetSvg("media/avatar_games.svg", "sl")).toBe(localizedAssetSvg("media/avatar_games.svg", "ru"));
  });

  it("getBuiltinTopicAsset passes the language through", () => {
    expect(decode(getBuiltinTopicAsset("propis2", "media/avatar_propis.svg", "sl"))).toBe(sl.trim());
    expect(decode(getBuiltinTopicAsset("propis2", "media/avatar_propis.svg"))).toBe(ru.trim());
  });

  it("every cover is a whole SVG", () => {
    for (const svg of [ru, sl, en]) expect(svg.trim()).toMatch(/^<svg[\s\S]*<\/svg>$/);
  });
});
