// Signup-burst load test against the local prod-like env (npm run test:env).
// Each virtual newcomer: register → verify (link from the fake mailbox) →
// bootstrap → catalog → claim + download one deck → sync a student →
// append a session. Meanwhile "already active" users hit bootstrap every
// second: their latency is what shows event-loop stalls (scryptSync, backup).
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";

const { values } = parseArgs({ options: {
  app: { type: "string", default: "http://127.0.0.1:4310" },
  mail: { type: "string", default: "http://127.0.0.1:4311" },
  stages: { type: "string", default: "50,150,300" },
  "window-sec": { type: "string", default: "60" },
  "same-ip": { type: "boolean", default: false },
  "mail-fail-after": { type: "string" },
  "bg-users": { type: "string", default: "5" },
} });
const APP = values.app, MAIL = values.mail;
const P95_LIMIT_MS = 1000;

const samples = {};           // endpoint -> [ms]
const errors = {};            // "endpoint status" -> count
const bgSamples = [];
let bgErrors = 0;

function pct(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
}

async function call(name, method, path, { token, body, ip } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ip) headers["X-Forwarded-For"] = ip;
  const t0 = performance.now();
  let res;
  try {
    res = await fetch(`${APP}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    errors[`${name} network`] = (errors[`${name} network`] || 0) + 1;
    return null;
  }
  const ms = performance.now() - t0;
  (samples[name] ||= []).push(ms);
  if (!res.ok) errors[`${name} ${res.status}`] = (errors[`${name} ${res.status}`] || 0) + 1;
  return res;
}

// Gives up after ~5 s: with --mail-fail-after, hundreds of clients polling for
// mail that never comes exhaust local sockets and distort every other number.
async function mailLink(email) {
  for (let i = 0; i < 25; i++) {
    const msgs = await (await fetch(`${MAIL}/messages?to=${encodeURIComponent(email)}`)).json();
    const m = msgs.at(-1)?.text.match(/verify-email\?token=([\w-]+)/);
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

let deckId = null;

async function newcomer(i, stage) {
  const email = `load-${stage}-${i}-${Date.now()}@example.test`;
  const ip = values["same-ip"] ? "10.0.0.1" : `10.${stage % 250}.${Math.floor(i / 250)}.${i % 250}`;
  const reg = await call("register", "POST", "/auth/register", { ip, body: { email, password: "correct horse battery", firstName: "Load", role: i % 3 ? "parent" : "specialist", referralSource: "other", consentPersonalData: true } });
  if (reg?.status !== 201) return;
  const vtoken = await mailLink(email);
  if (!vtoken) { errors["mail missing"] = (errors["mail missing"] || 0) + 1; return; }
  const ver = await call("verify-email", "GET", `/auth/verify-email?token=${vtoken}`, { ip });
  if (!ver?.ok) return;
  const { token } = await ver.json();
  await call("bootstrap", "GET", "/account/bootstrap", { token, ip });
  const cat = await call("decks/catalog", "GET", "/decks/catalog", { token, ip });
  if (cat?.ok && !deckId) deckId = (await cat.json()).decks?.[0]?.id ?? null;
  if (deckId) {
    await call("decks/claim", "POST", `/decks/${deckId}/claim`, { token, ip, body: {} });
    const dl = await call("decks/download", "GET", `/decks/${deckId}/download`, { token, ip });
    if (dl?.ok) await dl.arrayBuffer();
  }
  const studentId = randomUUID();
  await call("sync", "POST", "/sync", { token, ip, body: { operations: [{ type: "student.upsert", data: { id: studentId, name: "Ребёнок", comment: "" } }] } });
  await call("sessions", "POST", "/sessions", { token, ip, body: { id: randomUUID(), studentId, topicId: deckId ?? "unknown", topicVersion: "1", mode: "default", startedAt: new Date(Date.now() - 60000).toISOString(), completedAt: new Date().toISOString(), correctCount: 5, incorrectCount: 1, percentCorrect: 83, mistakes: [], cardEvents: [] } });
}

async function backgroundUser(stopSignal, idx) {
  const email = `bg-${idx}-${Date.now()}@example.test`;
  await call("register", "POST", "/auth/register", { ip: `10.250.0.${idx}`, body: { email, password: "correct horse battery", firstName: "Bg", role: "parent", referralSource: "other", consentPersonalData: true } });
  const vtoken = await mailLink(email);
  const { token } = await (await fetch(`${APP}/api/auth/verify-email?token=${vtoken}`)).json();
  while (!stopSignal.stop) {
    const t0 = performance.now();
    const r = await fetch(`${APP}/api/account/bootstrap`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    bgSamples.push(performance.now() - t0);
    if (!r?.ok) bgErrors++;
    await new Promise((res) => setTimeout(res, 1000));
  }
}

await fetch(`${MAIL}/reset`, { method: "POST" });
if (values["mail-fail-after"]) {
  await fetch(`${MAIL}/config`, { method: "POST", body: JSON.stringify({ failAfter: Number(values["mail-fail-after"]) }) });
}

const stopSignal = { stop: false };
const bg = Array.from({ length: Number(values["bg-users"]) }, (_, k) => backgroundUser(stopSignal, k + 1));
await new Promise((r) => setTimeout(r, 2000));

const summary = [];
let failed = false;
for (const users of values.stages.split(",").map(Number)) {
  for (const k of Object.keys(samples)) delete samples[k];
  for (const k of Object.keys(errors)) delete errors[k];
  bgSamples.length = 0; bgErrors = 0;
  const windowMs = Number(values["window-sec"]) * 1000;
  const jobs = Array.from({ length: users }, (_, i) =>
    new Promise((r) => setTimeout(r, Math.random() * windowMs)).then(() => newcomer(i, users)));
  await Promise.all(jobs);
  const mails = (await (await fetch(`${MAIL}/messages`)).json()).length;
  const latency = Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, { n: v.length, p50: pct(v, 50), p95: pct(v, 95), max: pct(v, 100) }]));
  const row = { stage: users, errors: { ...errors }, latency, bgLatency: { p50: pct(bgSamples, 50), p95: pct(bgSamples, 95), max: pct(bgSamples, 100) }, bgErrors, mailsCaptured: mails };
  summary.push(row);
  console.log(JSON.stringify(row, null, 2));
  const has5xx = Object.keys(errors).some((k) => / 5\d\d$| network$/.test(k));
  const slow = Object.values(latency).some((l) => l.p95 > P95_LIMIT_MS) || (row.bgLatency.p95 ?? 0) > P95_LIMIT_MS;
  if (has5xx || slow || bgErrors > 0) failed = true;
}
stopSignal.stop = true;
await Promise.all(bg);
console.log(failed ? "RESULT: FAIL (thresholds exceeded — see above)" : "RESULT: PASS");
process.exit(failed ? 1 : 0);
