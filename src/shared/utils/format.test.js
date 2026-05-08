import { describe, expect, it } from "vitest";
import { extractYoutubeId, isValidYoutubeUrl, makeYoutubeEmbedUrl } from "./format";

const VIDEO_ID = "dQw4w9WgXcQ";

describe("YouTube reward helpers", () => {
  it("extracts ids from supported YouTube URL formats", () => {
    expect(extractYoutubeId(`https://www.youtube.com/watch?v=${VIDEO_ID}`)).toBe(VIDEO_ID);
    expect(extractYoutubeId(`https://m.youtube.com/watch?v=${VIDEO_ID}&feature=share`)).toBe(VIDEO_ID);
    expect(extractYoutubeId(`https://youtu.be/${VIDEO_ID}?si=test`)).toBe(VIDEO_ID);
    expect(extractYoutubeId(`https://www.youtube.com/embed/${VIDEO_ID}`)).toBe(VIDEO_ID);
    expect(extractYoutubeId(`https://www.youtube.com/shorts/${VIDEO_ID}`)).toBe(VIDEO_ID);
    expect(extractYoutubeId(`https://www.youtube.com/live/${VIDEO_ID}?feature=share`)).toBe(VIDEO_ID);
    expect(extractYoutubeId(`https://www.youtube-nocookie.com/embed/${VIDEO_ID}`)).toBe(VIDEO_ID);
    expect(extractYoutubeId(VIDEO_ID)).toBe(VIDEO_ID);
  });

  it("rejects invalid YouTube values", () => {
    expect(extractYoutubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(extractYoutubeId("https://www.youtube.com/watch?v=bad")).toBeNull();
    expect(isValidYoutubeUrl("https://www.youtube.com/watch?v=bad")).toBe(false);
  });

  it("builds a playable embed URL", () => {
    const embedUrl = makeYoutubeEmbedUrl(VIDEO_ID);
    const parsed = new URL(embedUrl);

    expect(parsed.origin).toBe("https://www.youtube.com");
    expect(parsed.pathname).toBe(`/embed/${VIDEO_ID}`);
    expect(parsed.searchParams.get("autoplay")).toBe("1");
    expect(parsed.searchParams.get("playsinline")).toBe("1");
    expect(parsed.searchParams.get("origin")).toBe(window.location.origin);
  });
});
