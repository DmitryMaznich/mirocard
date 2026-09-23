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

export async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return null;
  const raw = Buffer.concat(chunks).toString("utf8");
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
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) throw { status: 413, message: "Payload too large" };
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function writeAudio(response, audioBuffer, contentType) {
  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": audioBuffer.length,
    "Cache-Control": "no-store",
  });
  response.end(audioBuffer);
}
