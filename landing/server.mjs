import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url)).replace(/[\\/]+$/, '');
const PORT = process.env.PORT || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const relative = normalize(urlPath === '/' ? '/index.html' : urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(ROOT, relative);

  const isRoot = filePath === ROOT;
  const isInsideRoot = filePath.startsWith(ROOT + sep);
  const isServerSource = relative.replace(/^[\\/]+/, '') === 'server.mjs';
  if ((!isInsideRoot && !isRoot) || isServerSource) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  try {
    const stats = await stat(filePath);
    if (stats.isDirectory()) throw new Error('is a directory');
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}).listen(PORT, () => {
  console.log(`landing listening on :${PORT}`);
});
