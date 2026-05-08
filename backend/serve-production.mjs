import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATIC_DIR = process.env.MIROCARD_STATIC_DIR || path.resolve(__dirname, "../dist");
const API_PORT = Number(process.env.MIROCARD_API_PORT || 3012);
const PORT = Number(process.env.PORT || 8080);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".wav": "audio/wav",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".zip": "application/zip",
};

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function proxyApi(request, response) {
  const upstreamPath = request.url.replace(/^\/api(?=\/|$|\?)/, "") || "/";

  const proxiedRequest = httpRequest(
    {
      hostname: "127.0.0.1",
      port: API_PORT,
      path: upstreamPath.startsWith("?") ? `/${upstreamPath}` : upstreamPath,
      method: request.method,
      headers: request.headers,
    },
    (proxiedResponse) => {
      response.writeHead(proxiedResponse.statusCode || 502, proxiedResponse.headers);
      proxiedResponse.pipe(response);
    },
  );

  proxiedRequest.on("error", (error) => {
    response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Upstream API unavailable.", details: error.message }));
  });

  request.pipe(proxiedRequest);
}

async function serveStatic(requestPath, response) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const safePath = path.normalize(normalizedPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(STATIC_DIR, safePath);

  if (!(await fileExists(filePath))) {
    filePath = path.join(STATIC_DIR, "index.html");
  }

  const info = await stat(filePath);

  response.writeHead(200, {
    "Content-Type": getMimeType(filePath),
    "Content-Length": info.size,
    "Cache-Control": (filePath.endsWith("sw.js") || filePath.endsWith("index.html") || filePath.endsWith("manifest.json"))
      ? "no-store, no-cache, must-revalidate"
      : "public, max-age=86400",
  });

  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (requestUrl.pathname.startsWith("/api/")) {
    proxyApi(request, response);
    return;
  }

  try {
    await serveStatic(requestUrl.pathname, response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Failed to serve app: ${error instanceof Error ? error.message : String(error)}`);
  }
});

server.listen(PORT, () => {
  console.log(`Mirocard2 web server listening on http://0.0.0.0:${PORT}`);
});
