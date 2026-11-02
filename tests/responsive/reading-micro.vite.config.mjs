import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react()], publicDir: false,
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  define: { __APP_VERSION__: JSON.stringify("1.0.2606"), __BUILD_TIME__: JSON.stringify("preview"), __GIT_SHA__: JSON.stringify("preview") },
  optimizeDeps: { entries: ["tests/responsive/reading-micro.html"] },
  build: { target: "esnext", outDir: ".cache/reading-micro-preview", emptyOutDir: true, rollupOptions: { input: "tests/responsive/reading-micro.html" } },
});
