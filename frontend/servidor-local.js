// Servidor local del frontend (puerto 3000): sirve /public y reenvía /api/* al backend.
// Es lo mismo que hace la regla "rewrites" de vercel.json en producción, así el navegador
// siempre habla con un solo dominio y la cookie de sesión funciona igual.
// Uso: npm run dev   ·   Backend en otra dirección: API_URL=http://localhost:3001 npm run dev
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '');
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};
// Encabezados que no se copian al reenviar (los maneja cada conexión por su cuenta)
const SALTAR = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'content-encoding', 'keep-alive']);

async function reenviarApi(req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!SALTAR.has(k)) headers[k] = v;
  let r;
  try {
    r = await fetch(API + req.url, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
      redirect: 'manual',
    });
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: `El backend no responde en ${API}. ¿Está encendido?` }));
  }
  res.statusCode = r.status;
  r.headers.forEach((v, k) => { if (!SALTAR.has(k) && k !== 'set-cookie') res.setHeader(k, v); });
  const cookies = r.headers.getSetCookie();
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.end(Buffer.from(await r.arrayBuffer()));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await reenviarApi(req, res);

    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(publicDir, p));
    if (!file.startsWith(publicDir)) { res.statusCode = 403; return res.end(); }
    const data = await fs.readFile(file).catch(() => null);
    if (!data) { res.statusCode = 404; return res.end('No encontrado'); }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) { res.statusCode = 500; res.end('Error del servidor'); }
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`Frontend en http://localhost:${port}  (API → ${API})`));
