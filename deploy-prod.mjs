#!/usr/bin/env node
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const distDir = path.join(root, "dist");
const caddyTemplate = path.join(root, "deploy", "windows", "Caddyfile.8080");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

const args = new Set(process.argv.slice(2));
const verifyOnly = args.has("--verify-only");
const allowDirty = args.has("--allow-dirty") || process.env.MIROCARD_DEPLOY_ALLOW_DIRTY === "1";
const skipBuild = args.has("--skip-build");
const noBump = args.has("--no-bump");

const deployHosts = (process.env.MIROCARD_DEPLOY_HOSTS || "100.72.91.115,192.168.1.163")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const sshPort = Number(process.env.MIROCARD_DEPLOY_PORT || 22);
const sshUser = process.env.MIROCARD_DEPLOY_USER || "dmazn";
const remoteRoot = process.env.MIROCARD_REMOTE_ROOT || "C:/Users/dmazn/Projects/Mirocard2";
const publicUrl = (process.env.MIROCARD_PUBLIC_URL || "https://mirocard.kaplieva.help").replace(/\/+$/, "");
const lanUrl = (process.env.MIROCARD_LAN_URL || "http://192.168.1.163:8080").replace(/\/+$/, "");

function run(command, args = [], options = {}) {
  execFileSync(command, args, { cwd: root, stdio: "inherit", ...options });
}

function output(command) {
  return execSync(command, { cwd: root, encoding: "utf8" }).trim();
}

function gitSha() {
  try {
    return output("git rev-parse --short HEAD") || "unknown";
  } catch {
    return "unknown";
  }
}

function bumpPatchVersion() {
  const pkgPath = path.join(root, "package.json");
  const pkgRaw = JSON.parse(readFileSync(pkgPath, "utf8"));
  const parts = pkgRaw.version.split(".").map(Number);
  parts[2] += 1;
  pkgRaw.version = parts.join(".");
  writeFileSync(pkgPath, JSON.stringify(pkgRaw, null, 2) + "\n");
  pkg.version = pkgRaw.version;
  execSync(`git add package.json && git commit -m "chore: release v${pkg.version}"`, { cwd: root, stdio: "inherit" });
  console.log(`bumped version to ${pkg.version}`);
}

function assertCleanWorktree() {
  if (allowDirty || verifyOnly) return;
  const status = output("git status --porcelain");
  if (!status) return;

  console.error("Refusing to deploy with a dirty worktree.");
  console.error("Commit/stash changes first, or pass --allow-dirty for an explicit emergency deploy.");
  process.exit(1);
}

function collectFiles(dir, prefix = "") {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue; // skip junctions/symlinks (Windows reparse points)
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(absPath, relPath));
    } else {
      files.push({
        local: absPath.replace(/\\/g, "/"),
        remote: `${remoteRoot}/dist/${relPath}`.replace(/\\/g, "/"),
      });
    }
  }
  return files;
}

function writeVersionJson() {
  const version = {
    version: pkg.version,
    buildTime: new Date().toISOString(),
    gitSha: gitSha(),
    runtime: "windows-caddy",
    publicUrl,
  };
  writeFileSync(path.join(distDir, "version.json"), JSON.stringify(version, null, 2) + "\n");
  return version;
}

function buildUploadPlan() {
  if (!existsSync(distDir)) {
    throw new Error("dist/ does not exist. Run npm run build first.");
  }

  const files = collectFiles(distDir);
  if (existsSync(caddyTemplate)) {
    files.push({
      local: caddyTemplate.replace(/\\/g, "/"),
      remote: `${remoteRoot}/deploy/windows/Caddyfile.8080`.replace(/\\/g, "/"),
    });
  }
  return files;
}

function upload(files) {
  const password = process.env.MIROCARD_DEPLOY_PASSWORD || "";
  const keyPath = process.env.MIROCARD_DEPLOY_KEY_PATH || "";
  if (!password && !keyPath) {
    throw new Error("Set MIROCARD_DEPLOY_PASSWORD or MIROCARD_DEPLOY_KEY_PATH before deploying.");
  }

  const pyPath = path.join(tmpdir(), `mirocard2_deploy_prod_${Date.now()}.py`);
  writeFileSync(pyPath, `
import os
import posixpath
import paramiko
import sys

HOSTS = ${JSON.stringify(deployHosts)}
PORT = ${JSON.stringify(sshPort)}
USER = ${JSON.stringify(sshUser)}
PASSWORD = os.environ.get("MIROCARD_DEPLOY_PASSWORD") or None
KEY_PATH = os.environ.get("MIROCARD_DEPLOY_KEY_PATH") or None
FILES = ${JSON.stringify(files, null, 2)}

def mkdir_p(sftp, remote_path):
    parts = remote_path.replace("\\\\", "/").split("/")
    current = parts[0]
    for part in parts[1:]:
        current = current + "/" + part
        try:
            sftp.stat(current)
        except IOError:
            sftp.mkdir(current)

def connect():
    last_error = None
    for host in HOSTS:
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            kwargs = {
                "hostname": host,
                "port": PORT,
                "username": USER,
                "timeout": 15,
                "banner_timeout": 30,
            }
            if KEY_PATH:
                kwargs["key_filename"] = KEY_PATH
            else:
                kwargs["password"] = PASSWORD
            client.connect(**kwargs)
            client.get_transport().set_keepalive(20)
            print(f"connected {host}:{PORT}")
            return client
        except Exception as exc:
            last_error = exc
            print(f"connect failed {host}:{PORT}: {exc}")
    raise last_error

client = connect()
sftp = client.open_sftp()
for item in FILES:
    remote_dir = posixpath.dirname(item["remote"])
    mkdir_p(sftp, remote_dir)
    sftp.put(item["local"], item["remote"])
    print("uploaded", item["remote"])
sftp.close()
client.close()
`);

  run("python", [pyPath]);
}

async function fetchJson(url) {
  const resp = await fetch(`${url}/version.json?check=${Date.now()}`, { cache: "no-store" });
  if (!resp.ok) throw new Error(`${url}/version.json returned ${resp.status}`);
  return resp.json();
}

async function fetchApiVersion(url) {
  const resp = await fetch(`${url}/api/version?check=${Date.now()}`, { cache: "no-store" });
  if (!resp.ok) throw new Error(`${url}/api/version returned ${resp.status}`);
  return resp.json();
}

async function verify(expectedVersion) {
  const targets = [publicUrl, lanUrl];
  let referenceVersion = null;
  for (const target of targets) {
    const version = await fetchJson(target);
    if (expectedVersion?.buildTime && version.buildTime !== expectedVersion.buildTime) {
      throw new Error(`${target} serves buildTime ${version.buildTime}, expected ${expectedVersion.buildTime}`);
    }
    if (!expectedVersion?.buildTime && referenceVersion?.buildTime && version.buildTime !== referenceVersion.buildTime) {
      throw new Error(`${target} serves buildTime ${version.buildTime}, expected ${referenceVersion.buildTime}`);
    }
    referenceVersion ??= version;
    console.log(`verified ${target}/version.json -> ${version.version} ${version.gitSha || ""}`.trim());
  }

  const apiVersion = await fetchApiVersion(publicUrl);
  if (referenceVersion?.buildTime && apiVersion.buildTime && apiVersion.buildTime !== referenceVersion.buildTime) {
    throw new Error(`${publicUrl}/api/version serves buildTime ${apiVersion.buildTime}, expected ${referenceVersion.buildTime}`);
  }
  console.log(`verified ${publicUrl}/api/version -> ${apiVersion.version || "unknown"}`);
}

async function main() {
  let version = null;
  if (!verifyOnly) {
    if (!skipBuild) {
      assertCleanWorktree();
      if (!noBump) bumpPatchVersion();
      console.log(`building Mirocard2 v${pkg.version}...`);
      execSync("npm run build", { cwd: root, stdio: "inherit" });
    }
    version = writeVersionJson();
    const files = buildUploadPlan();
    console.log(`uploading ${files.length} files to canonical Windows/Caddy runtime...`);
    upload(files);
  } else {
    version = null;
  }

  await verify(version);
  console.log("deploy target is consistent.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
