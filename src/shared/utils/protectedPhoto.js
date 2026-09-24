import { useEffect, useMemo, useState } from "react";
import { getApiToken } from "@/core/api";

// User photos (/api/photos/<hash>) are served only to the owning account and
// only with an Authorization header -- which a plain <img src>, an SVG
// <image href> or a CSS url() can never send. Every place that shows a user
// photo goes through this module: it fetches the bytes with the token and
// hands out a blob: URL.
//
// Deck-ZIP renderers (e.g. sentence_puzzle) bundle their own copy of this
// file and of @/core/api, whose module-level token is never set inside the
// ZIP. So the token getter and the cache are taken from window.__Mirocard
// (set by main.jsx) when present: one cache, one token, whichever bundle
// asks.

const PHOTO_URL_RE = /\/api\/photos\/[0-9a-f]{32}(?:$|[?#])/;

export function isProtectedPhotoUrl(src) {
  return typeof src === "string" && PHOTO_URL_RE.test(src);
}

function shared() {
  const host = typeof window !== "undefined" ? window : globalThis;
  host.__Mirocard = host.__Mirocard ?? {};
  host.__Mirocard.photoCache = host.__Mirocard.photoCache ?? new Map();
  return host.__Mirocard;
}

function currentToken() {
  const fromHost = shared().getApiToken;
  return (typeof fromHost === "function" ? fromHost() : null) ?? getApiToken();
}

/** Drops every cached blob URL (call on login/logout: photos are per-account). */
export function clearProtectedPhotoCache() {
  const cache = shared().photoCache;
  for (const entry of cache.values()) {
    entry.then((url) => { if (url) URL.revokeObjectURL(url); }).catch(() => {});
  }
  cache.clear();
}

/** Resolves a protected photo URL to a blob: URL (cached per session). */
export function loadProtectedPhoto(src) {
  const host = shared();
  const token = currentToken();
  // Photos are per-account: a different token (logout/login, account
  // switch) must never be served another account's cached photo.
  if (host.photoCacheToken !== token) {
    clearProtectedPhotoCache();
    host.photoCacheToken = token;
  }
  const cache = host.photoCache;
  if (cache.has(src)) return cache.get(src);
  const promise = fetch(src, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
    .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((blob) => URL.createObjectURL(blob));
  // A failure (401 before login finished, a transient network error) must
  // not be cached forever -- the next render retries.
  promise.catch(() => cache.delete(src));
  cache.set(src, promise);
  return promise;
}

/**
 * Hook: returns a src usable by <img>, SVG <image> or CSS -- the input
 * unchanged for anything that isn't a protected photo (data:, blob:,
 * bundled assets), a blob: URL once a protected photo has loaded, and null
 * while loading or if it can't be loaded.
 */
export function useProtectedPhotoSrc(src) {
  const needsAuth = isProtectedPhotoUrl(src);
  const [resolved, setResolved] = useState({ src: null, url: null });

  useEffect(() => {
    if (!needsAuth) return undefined;
    let cancelled = false;
    loadProtectedPhoto(src)
      .then((url) => { if (!cancelled) setResolved({ src, url }); })
      .catch(() => { if (!cancelled) setResolved({ src, url: null }); });
    return () => { cancelled = true; };
  }, [src, needsAuth]);

  if (!needsAuth) return src ?? null;
  return resolved.src === src ? resolved.url : null;
}

function collectProtectedUrls(value, into, depth = 0) {
  if (depth > 12 || value == null) return into;
  if (typeof value === "string") {
    if (isProtectedPhotoUrl(value)) into.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectProtectedUrls(item, into, depth + 1);
  } else if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    for (const item of Object.values(value)) collectProtectedUrls(item, into, depth + 1);
  }
  return into;
}

function replaceProtectedUrls(value, resolved, depth = 0) {
  if (depth > 12 || value == null) return value;
  if (typeof value === "string") {
    return isProtectedPhotoUrl(value) ? (resolved.get(value) ?? null) : value;
  }
  if (Array.isArray(value)) return value.map((item) => replaceProtectedUrls(item, resolved, depth + 1));
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = replaceProtectedUrls(v, resolved, depth + 1);
    return out;
  }
  return value;
}

/**
 * Hook: a copy of `value` (plain objects/arrays) with every protected photo
 * URL replaced by its loaded blob: URL (null until loaded). Used by
 * SessionScreen on the task/student props it hands to topic renderers, so
 * renderers shipped as deck ZIPs -- which render photos with a plain <img>
 * or SVG <image> and can't be changed without republishing the ZIP -- get
 * displayable URLs. Returns `value` itself when it contains no such URL.
 */
export function useResolvedProtectedPhotos(value) {
  const urls = [...collectProtectedUrls(value, new Set())].sort();
  const key = urls.join("|");
  const [resolved, setResolved] = useState(() => new Map());

  useEffect(() => {
    if (!urls.length) return undefined;
    let cancelled = false;
    Promise.all(urls.map((u) => loadProtectedPhoto(u).then((b) => [u, b], () => [u, null])))
      .then((pairs) => { if (!cancelled) setResolved(new Map(pairs)); });
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(
    () => (urls.length ? replaceProtectedUrls(value, resolved) : value),
    [value, resolved, key], // eslint-disable-line react-hooks/exhaustive-deps
  );
}
