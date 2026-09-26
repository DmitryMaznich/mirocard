// Starts the production build exactly the way Railway runs it
// (node backend/server.mjs, SERVE_STATIC=1) on a throwaway database,
// with email going to the local fake instead of Resend.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { createFakeResend } from "./fake-resend.mjs";

const { values } = parseArgs({ options: {
  "app-port": { type: "string", default: "4310" },
  "mail-port": { type: "string", default: "4311" },
  build: { type: "boolean", default: false },
} });

if (values.build || !existsSync("dist/index.html")) {
  const r = spawnSync("npm", ["run", "build"], { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const mail = await createFakeResend({ port: Number(values["mail-port"]) });
const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-prodlike-"));
const appUrl = `http://127.0.0.1:${values["app-port"]}`;

const app = spawn(process.execPath, ["backend/server.mjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: values["app-port"],
    SERVE_STATIC: "1",
    MIROCARD_DATA_DIR: dataDir,
    APP_BASE_URL: appUrl,
    CORS_ALLOWED_ORIGINS: appUrl,
    RESEND_API_KEY: "test-resend-key",
    RESEND_API_URL: `${mail.url}/emails`,
    AUTH_SECRET: "test-auth-secret",
    ACCOUNT_SECRET: "test-account-secret",
    MIROCARD_ADMIN_TOKEN: "test-admin-token",
    RAILWAY_ENVIRONMENT: "",
    ERROR_REPORTING_WEBHOOK_URL: "",
    ANALYTICS_WEBHOOK_URL: "",
  },
});
console.log(`[test-env] app ${appUrl}  mail ${mail.url}  data ${dataDir}`);
// Tests that must bend server state no API exposes (e.g. an expired trial) find the DB here.
mkdirSync("output", { recursive: true });
writeFileSync("output/test-env.json", JSON.stringify({ appUrl, mailUrl: mail.url, dataDir }));

let stopping = false;
async function stop(code = 0) {
  if (stopping) return; stopping = true;
  app.kill();
  await mail.close();
  try { rmSync(dataDir, { recursive: true, force: true }); } catch {}
  process.exit(code);
}
app.on("exit", (c) => stop(c ?? 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
