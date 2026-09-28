// Servidor local del backend que imita a Vercel: ejecuta las funciones de /api (puerto 3001).
// Uso: npm run dev  (lee las variables de backend/.env)
import dotenv from 'dotenv';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const publicDir = path.join(root, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };

  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/\/$/, '');
      const file = path.join(root, 'api', name + '.js');
      if (!/^[a-z-]+$/.test(name) || !(await fs.stat(file).catch(() => null))) {
        return res.status(404).json({ error: 'No encontrado' });
      }
      req.query = Object.fromEntries(url.searchParams);
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw && (req.headers['content-type'] || '').includes('application/json')) {
        try {
          req.body = JSON.parse(raw);
        } catch {
          return res.status(400).json({ error: 'JSON no válido' });
        }
      } else {
        req.body = raw || undefined;
      }
      const mod = await import(pathToFileURL(file).href);
      return await mod.default(req, res);
    }

    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(publicDir, p));
    if (!file.startsWith(publicDir)) return res.status(403).end();
    const data = await fs.readFile(file).catch(() => null);
    if (!data) return res.status(404).end('No encontrado');
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Error del servidor' });
  }
});

const port = Number(process.env.API_PORT) || 3001;
server.listen(port, () => console.log(`Backend (API) en http://localhost:${port}`));
