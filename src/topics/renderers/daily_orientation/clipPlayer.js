import { useCallback, useEffect, useRef } from "react";
import { clipUrl } from "./audioBank.js";

// Plays one spoken sentence assembled from several recorded clips (see
// audioBank.js). Web Audio rather than chained <audio> elements, because each
// Gemini clip carries ~0.1-0.2s of silence at both ends: back-to-back <audio>
// playback adds those up into a gap long enough to break the sentence apart,
// while decoded buffers can be trimmed and scheduled with one fixed short
// pause between parts.
const JOIN_GAP_SECONDS = 0.12;
const SILENCE_THRESHOLD = 0.01;
const EDGE_PAD_SECONDS = 0.03;

let sharedContext = null;
const bufferCache = new Map();

function getContext() {
  if (sharedContext) return sharedContext;
  const AudioContextClass = typeof window === "undefined" ? null : window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return null;
  sharedContext = new AudioContextClass();
  return sharedContext;
}

function trimSilence(context, buffer) {
  const data = buffer.getChannelData(0);
  const pad = Math.round(EDGE_PAD_SECONDS * buffer.sampleRate);
  let start = 0;
  let end = data.length - 1;
  while (start < data.length && Math.abs(data[start]) < SILENCE_THRESHOLD) start++;
  while (end > start && Math.abs(data[end]) < SILENCE_THRESHOLD) end--;
  start = Math.max(0, start - pad);
  end = Math.min(data.length, end + pad);
  if (end <= start) return buffer;
  const trimmed = context.createBuffer(1, end - start, buffer.sampleRate);
  trimmed.copyToChannel(data.subarray(start, end), 0);
  return trimmed;
}

function loadClip(context, key) {
  if (!bufferCache.has(key)) {
    const promise = fetch(clipUrl(key))
      .then((response) => {
        if (!response.ok) throw new Error(`clip ${key}: HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      // Callback form: older Safari's decodeAudioData doesn't return a promise.
      .then((bytes) => new Promise((resolve, reject) => context.decodeAudioData(bytes, resolve, reject)))
      .then((buffer) => trimSilence(context, buffer));
    // A failed load must not stay cached forever -- a flaky connection on the
    // first tap would otherwise mean browser-TTS fallback for the whole session.
    promise.catch(() => bufferCache.delete(key));
    bufferCache.set(key, promise);
  }
  return bufferCache.get(key);
}

// Synchronous check so callers can go straight to browser TTS (without
// waiting on a promise) where Web Audio doesn't exist at all, e.g. jsdom.
export function clipsSupported() {
  return typeof window !== "undefined" && Boolean(window.AudioContext ?? window.webkitAudioContext);
}

export function useClipPlayer() {
  const activeSourcesRef = useRef([]);
  const tokenRef = useRef(0);

  const stop = useCallback(() => {
    tokenRef.current++;
    activeSourcesRef.current.forEach((source) => {
      try { source.stop(); } catch { /* already stopped */ }
    });
    activeSourcesRef.current = [];
  }, []);

  useEffect(() => stop, [stop]);

  // Resolves true if the clips played, false if they couldn't (no Web Audio,
  // a missing/undecodable file) so the caller can fall back to browser TTS.
  const play = useCallback(async (keys) => {
    stop();
    const token = tokenRef.current;
    const context = getContext();
    if (!context) return false;
    // Must be kicked from inside the tap handler on iOS, before any await.
    const resumed = context.state === "suspended" ? context.resume() : null;
    let buffers;
    try {
      buffers = await Promise.all(keys.map((key) => loadClip(context, key)));
      await resumed;
    } catch {
      return false;
    }
    if (token !== tokenRef.current) return true;
    let at = context.currentTime + 0.02;
    activeSourcesRef.current = buffers.map((buffer) => {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(at);
      at += buffer.duration + JOIN_GAP_SECONDS;
      return source;
    });
    return true;
  }, [stop]);

  return { play, stop };
}
