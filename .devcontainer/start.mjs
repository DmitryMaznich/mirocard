import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFakeResend } from "../scripts/test-env/fake-resend.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const stateDir = path.join(root, "runtime", "codespaces");
mkdirSync(stateDir, { recursive: true });
const secretsFile = path.join(stateDir, "secrets.json");
try {
  const fd = openSync(secretsFile, "wx", 0o600);
  try {
    writeFileSync(fd, JSON.stringify(Object.fromEntries(
      ["AUTH_SECRET", "ACCOUNT_SECRET", "MIROCARD_ADMIN_TOKEN", "MIROCARD_DEPLOY_TOKEN"]
        .map((key) => [key, randomBytes(32).toString("hex")]),
    )));
  } finally { closeSync(fd); }
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
const secrets = JSON.parse(readFileSync(secretsFile, "utf8"));
const appUrl = process.env.CODESPACE_NAME
  ? `https://${process.env.CODESPACE_NAME}-8080.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev"}`
  : "http://localhost:8080";

// Deliberately do not inherit integration credentials or load .env files.
// The dev backend always uses its own database and the local mail catcher.
const backendEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR || "/tmp",
  NODE_ENV: "development",
  PORT: "3012",
  SERVE_STATIC: "0",
  RAILWAY_ENVIRONMENT: "",
  MIROCARD_DATA_DIR: path.join(stateDir, "data"),
  MIROCARD_DEPLOY_FRONTEND_DIR: path.join(root, "public"),
  APP_BASE_URL: appUrl,
  CORS_ALLOWED_ORIGINS: appUrl,
  RESEND_API_KEY: "codespaces-local-mail",
  LEGAL_DOCS_VERSION: "draft",
  ...secrets,
};

const mail = await createFakeResend({ port: 4311 });
backendEnv.RESEND_API_URL = `${mail.url}/emails`;
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  void mail.close();
  const timer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
    process.exit(code);
  }, 3000);
  Promise.all(children.map((child) => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once("exit", resolve);
  }))).then(() => { clearTimeout(timer); process.exit(code); });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
function run(args, env) {
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: "inherit" });
  children.push(child);
  child.on("error", (error) => { console.error(error); stop(1); });
  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(`[dev] Process stopped (${signal || code}); stopping the environment.`);
      stop(code || 1);
    }
  });
}
run(["--watch", "backend/server.mjs"], backendEnv);
run([
  "node_modules/vite/bin/vite.js", "--config", ".devcontainer/vite.config.mjs",
  "--configLoader", "native", "--host", "0.0.0.0", "--port", "8080", "--strictPort",
], {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR || "/tmp",
  NODE_ENV: "development",
  VITE_API_URL: "/api",
  MIROCARD_DEV_UNBUNDLED: process.env.MIROCARD_DEV_UNBUNDLED || "0",
  ...(process.env.CODESPACE_NAME ? { CODESPACE_NAME: process.env.CODESPACE_NAME } : {}),
  ...(process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? { GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN } : {}),
});
console.log(`[dev] App: ${appUrl}`);
console.log(`[dev] Test emails: ${appUrl}/__dev/mail`);
console.log("[dev] Database persists in runtime/codespaces/data. Ctrl+C stops both servers.");
