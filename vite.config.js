import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function stripApiPrefix(requestPath) {
  const nextPath = requestPath.replace(/^\/api(?=\/|$|\?)/, "") || "/";
  return nextPath.startsWith("?") ? `/${nextPath}` : nextPath;
}

const apiProxy = {
  "/api": {
    target: "http://127.0.0.1:3012",
    changeOrigin: true,
    rewrite: stripApiPrefix,
  },
};

function gitSha() {
  try {
    const gitDir = path.resolve(__dirname, ".git");
    const headPath = path.join(gitDir, "HEAD");
    if (!existsSync(headPath)) return "unknown";

    const head = readFileSync(headPath, "utf8").trim();
    if (!head.startsWith("ref: ")) {
      return head.slice(0, 7) || "unknown";
    }

    const refPath = path.join(gitDir, head.slice(5).replace(/\//g, path.sep));
    if (!existsSync(refPath)) return "unknown";
    return readFileSync(refPath, "utf8").trim().slice(0, 7) || "unknown";
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { emptyOutDir: false },
  server: {
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GIT_SHA__: JSON.stringify(gitSha()),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test-setup.js"],
    exclude: ["**/node_modules/**", "**/dist/**", "runtime/**", ".superpowers/**"],
  },
});
