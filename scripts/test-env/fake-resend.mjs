// Local stand-in for https://api.resend.com/emails used by test runs only.
// Stores every message in memory; GET /messages?to= lets tests read the
// verification/reset links. failAfter/failStatus simulate Resend's quota.
import { createServer } from "node:http";

export function extractLink(message, pathPart) {
  const m = String(message?.text || "").match(/https?:\/\/\S+/g) || [];
  return m.find((u) => u.includes(pathPart)) ?? null;
}

export function createFakeResend({ port = 0, failAfter = Infinity, failStatus = 429 } = {}) {
  const messages = [];
  const cfg = { failAfter, failStatus, accepted: 0 };

  const readBody = (req) => new Promise((resolve) => {
    let b = ""; req.on("data", (c) => (b += c)).on("end", () => resolve(b));
  });
  const json = (res, status, obj) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (req.method === "POST" && url.pathname === "/emails") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (cfg.accepted >= cfg.failAfter) return json(res, cfg.failStatus, { name: "rate_limit_exceeded", message: "fake quota exhausted" });
      cfg.accepted++;
      messages.push({ to: body.to, subject: body.subject, text: body.text, html: body.html, at: new Date().toISOString() });
      return json(res, 200, { id: `fake_${messages.length}` });
    }
    if (req.method === "GET" && url.pathname === "/messages") {
      const to = url.searchParams.get("to");
      return json(res, 200, to ? messages.filter((m) => m.to === to) : messages);
    }
    if (req.method === "POST" && url.pathname === "/config") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if ("failAfter" in body) cfg.failAfter = body.failAfter ?? Infinity;
      if ("failStatus" in body) cfg.failStatus = body.failStatus;
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/reset") {
      messages.length = 0; cfg.accepted = 0; cfg.failAfter = Infinity;
      return json(res, 200, { ok: true });
    }
    json(res, 404, { error: "not found" });
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${server.address().port}`;
    resolve({ url, messages, close: () => new Promise((r) => server.close(r)) });
  }));
}
