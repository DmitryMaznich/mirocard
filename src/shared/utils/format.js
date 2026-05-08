export function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getTopicTitle(title, lang = "ru") {
  if (!title) return "";
  if (typeof title === "string") return title;
  return title[lang] ?? title.ru ?? title.en ?? "";
}

export function getInitials(name) {
  const str = typeof name === "string" ? name : getTopicTitle(name);
  if (!str) return "?";
  return str
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function normalizeYoutubeId(value) {
  const id = String(value || "").trim().split(/[?&#/]/)[0];
  return YOUTUBE_ID_RE.test(id) ? id : null;
}

export function extractYoutubeId(url) {
  const rawUrl = String(url || "").trim();
  if (!rawUrl) return null;
  const rawId = normalizeYoutubeId(rawUrl);
  if (rawId) return rawId;

  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    const pathParts = u.pathname.split("/").filter(Boolean);

    if (host === "youtu.be") {
      return normalizeYoutubeId(pathParts[0]);
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com") {
      const watchId = normalizeYoutubeId(u.searchParams.get("v"));
      if (watchId) return watchId;

      if (["embed", "shorts", "live", "v"].includes(pathParts[0])) {
        return normalizeYoutubeId(pathParts[1]);
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function isValidYoutubeUrl(url) {
  return extractYoutubeId(url) != null;
}

export function makeYoutubeEmbedUrl(videoId) {
  const id = normalizeYoutubeId(videoId);
  if (!id) return null;

  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    controls: "0",
    playsinline: "1",
    fs: "0",
    disablekb: "1",
    modestbranding: "1",
    iv_load_policy: "3",
  });

  if (typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null") {
    params.set("origin", window.location.origin);
  }

  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

export function computeRewardSeconds(modeId, cardCount) {
  const MULT = {
    intro: 0.5, yes_no: 1.0, find_n: 1.2,
    choose_word_by_picture: 1.3, choose_all: 1.6,
    question_answer: 0.8,
  };
  const base = Math.max(1, cardCount) * 6;
  const mult = MULT[modeId] ?? 1.0;
  return Math.round(Math.min(Math.max(base * mult, 60), 300));
}

export function formatRewardTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}с`;
}

// Returns "not_installed" | "installed" | "update_available"
export function getTopicCatalogStatus(catalogEntry, topicRecords) {
  const installed = topicRecords.find((r) => r.meta.id === catalogEntry.id);
  if (!installed) return "not_installed";
  if (installed.meta.version !== catalogEntry.version) return "update_available";
  return "installed";
}
