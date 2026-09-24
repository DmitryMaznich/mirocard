import { MAX_JSON_BODY_BYTES } from "./config.mjs";

export function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

export function writeNoContent(response) {
  response.writeHead(204, {});
  response.end();
}

// Every JSON body is size-capped (previously unbounded: one request could
// buffer arbitrary memory). Sync batches may legitimately carry several
// embedded photos, hence the generous default -- see MAX_JSON_BODY_BYTES.
// How much of an over-limit body we still read (and discard) so the client
// reliably receives our 413. Answering while the client is still uploading
// and then closing makes the client see ECONNRESET/EPIPE instead of the
// response. Beyond this cap (clearly abusive) we stop reading and close.
export const BODY_DRAIN_CAP_BYTES = 64 * 1024 * 1024;

/**
 * Reads a request body up to maxBytes. Over the limit it keeps reading and
 * discarding (up to drainCap) and then throws { status: 413 } -- so the
 * caller can answer 413 on a connection that is still in a clean state.
 * `closeConnection` on the error tells the caller the body could not be
 * fully drained and the connection must be closed after responding.
 */
export async function readLimitedBody(request, maxBytes, { drainCap = BODY_DRAIN_CAP_BYTES } = {}) {
  const declared = Number(request.headers?.["content-length"]);
  if (Number.isFinite(declared) && declared > drainCap) {
    throw { status: 413, message: "Payload too large", closeConnection: true };
  }
  const chunks = [];
  let total = 0;
  let over = false;
  for await (const chunk of request) {
    total += chunk.length;
    if (!over && total > maxBytes) {
      over = true;
      chunks.length = 0; // don't keep the oversized body in memory
    }
    if (over) {
      if (total > drainCap) throw { status: 413, message: "Payload too large", closeConnection: true };
      continue;
    }
    chunks.push(chunk);
  }
  if (over) throw { status: 413, message: "Payload too large", closeConnection: false };
  return Buffer.concat(chunks);
}

export async function readJsonBody(request, maxBytes = MAX_JSON_BODY_BYTES) {
  const raw = (await readLimitedBody(request, maxBytes)).toString("utf8");
  return raw ? JSON.parse(raw) : null;
}

export function getBearerToken(request) {
  const header = request.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

// Railway (and any reverse proxy in front of the backend) terminates the
// real client connection, so request.socket.remoteAddress is the proxy's
// own address, not the caller's -- X-Forwarded-For carries the original
// client IP as its first (leftmost) entry. Falls back to the raw socket
// address for a direct connection (e.g. local dev, or tests).
export function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return request.socket?.remoteAddress ?? "unknown";
}

// CORS headers used to be hardcoded to "*" (any origin) in every response
// helper in this file -- meaning any website could make an authenticated
// (Authorization-header-bearing) cross-origin request against this API on
// a visitor's behalf, using a token it had no business having but the
// browser would happily attach if the visitor was signed in via some other
// means... except tokens live in JS memory/localStorage here, not cookies,
// so the practical exposure was more about response-reading than
// credential-riding -- still, "any origin" is strictly more than this API
// needs. applyCors sets the actual CORS headers once, centrally, in
// server.mjs's router (see resolveAllowedOrigin there) rather than
// per-response-helper, and only when the request's Origin is on the
// configured allowlist; a same-origin request (the normal case -- the SPA
// and the API are served from the same origin in production) never sends
// an Origin header a browser cares about here at all, so this only ever
// matters for genuine cross-origin callers.
export function applyCors(response, allowedOrigin) {
  if (!allowedOrigin) return;
  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Vary", "Origin");
}

export async function readRawBody(request, maxBytes = 2 * 1024 * 1024) {
  return readLimitedBody(request, maxBytes);
}

export function writeAudio(response, audioBuffer, contentType) {
  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": audioBuffer.length,
    "Cache-Control": "no-store",
  });
  response.end(audioBuffer);
}
