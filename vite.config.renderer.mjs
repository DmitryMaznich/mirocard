import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RENDERER = process.env.RENDERER;
if (!RENDERER) throw new Error("RENDERER env var is required (e.g. RENDERER=sentence_puzzle)");

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    lib: {
      entry:    path.resolve(__dirname, `src/topics/renderers/${RENDERER}/index.jsx`),
      name:     "__MirocardRenderer",
      formats:  ["iife"],
      fileName: () => "renderer",
    },
    outDir:      path.resolve(__dirname, `tools/${RENDERER}/dist`),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      external: ["react", "react/jsx-runtime"],
      output: {
        globals: {
          "react":             "__Mirocard.React",
          "react/jsx-runtime": "__Mirocard.jsxRuntime",
        },
      },
    },
  },
});
