import { mergeConfig } from "vite";
import baseConfig from "../vite.config.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export default mergeConfig(baseConfig, {
  envDir: false,
  // Keep hot updates while avoiding hundreds of module requests over the tunnel.
  // Set MIROCARD_DEV_UNBUNDLED=1 to use the standard Vite server for comparison.
  experimental: { bundledDev: process.env.MIROCARD_DEV_UNBUNDLED !== "1" },
  server: {
    allowedHosts: process.env.CODESPACE_NAME
      ? [`${process.env.CODESPACE_NAME}-8080.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev"}`]
      : [],
  },
  plugins: [{
    name: "mirocard-dev-inbox",
    transformIndexHtml(html) {
      // Private Codespaces ports require their session cookie even for the
      // browser's manifest request (which otherwise omits credentials).
      return html.replace(/<link\b(?=[^>]*\brel=["']manifest["'])[^>]*>/gi,
        (tag) => tag.replace(/\s+crossorigin(?:=["'][^"']*["'])?/gi, "")
          .replace(/\s*\/?\s*>$/, ' crossorigin="use-credentials">'));
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split("?")[0] === "/__dev/reset") {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Перезапуск тестовой среды</title><p id="status">Отключаем старый service worker. Аккаунт и данные сохранятся.</p><script type="module">try { if ("serviceWorker" in navigator) { const registrations = await navigator.serviceWorker.getRegistrations(); await Promise.all(registrations.map(r => r.unregister())); } location.replace("/"); } catch { document.getElementById("status").textContent = "Не удалось отключить service worker. Откройте DevTools → Application → Service Workers → Unregister, затем обновите приложение."; }</script></html>`);
          return;
        }
        if (req.url?.split("?")[0] !== "/__dev/mail") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
        try {
          const response = await fetch("http://127.0.0.1:4311/messages", { signal: AbortSignal.timeout(3000) });
          if (!response.ok) throw new Error("Mail catcher unavailable");
          const messages = await response.json();
          const cards = messages.toReversed().map((message) => {
            const text = escapeHtml(message.text);
            const links = [...String(message.text ?? "").matchAll(/https?:\/\/[^\s<>"']+/g)]
              .map(([url]) => `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`).join("");
            return `<article><h2>${escapeHtml(message.subject)}</h2><p>${escapeHtml(message.to)} · ${escapeHtml(message.at)}</p><pre>${text}</pre>${links}</article>`;
          }).join("");
          res.end(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Тестовая почта Мирокард</title><style>body{font:17px system-ui;max-width:760px;margin:24px auto;padding:0 16px}article{border:1px solid #ccc;border-radius:12px;padding:16px;margin:16px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{overflow-wrap:anywhere}</style><h1>Тестовая почта</h1><p>Письма не отправляются получателям. Обновите страницу после регистрации или восстановления пароля.</p><p><a href="/">Открыть приложение</a> · <a href="/__dev/mail">Обновить почту</a></p>${cards || "<p>Писем пока нет.</p>"}</html>`);
        } catch {
          res.statusCode = 503;
          res.end("Тестовая почта недоступна. Запустите node .devcontainer/start.mjs");
        }
      });
    },
  }],
});
