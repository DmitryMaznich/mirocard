import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gitSha } from "./scripts/git-sha.mjs";

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
    __GIT_SHA__: JSON.stringify(gitSha(__dirname)),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test-setup.js"],
    // Vitest's own default include glob (**/*.{test,spec}.?(c|m)[jt]sx?)
    // would otherwise also pick up backend/tests/*.test.mjs and
    // tools/**/*.test.mjs, which use Node's built-in node:test runner
    // (see backend/package.json's own "test" script) and fail outright
    // under Vitest -- not because they're broken, but because they're a
    // different, incompatible test API. A .worktrees/ checkout sitting
    // alongside the repo (a known per-task Claude Code artifact, see
    // .gitignore) would get swept in the same way if it ever exists here.
    exclude: [
      "**/node_modules/**", "**/dist/**", "runtime/**", ".superpowers/**",
      "backend/**", "tools/**", ".worktrees/**", ".claude/worktrees/**", ".pytest_cache/**",
    ],
    pool: "vmForks",
  },
});
