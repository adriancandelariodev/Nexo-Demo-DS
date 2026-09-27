import { SignJWT, jwtVerify } from 'jose';
import { q } from './db.js';

const COOKIE = 'nexo_session';

function secreto() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET debe tener al menos 32 caracteres');
  return new TextEncoder().encode(s);
}

export async function crearSesion(res, usuario, recordar) {
  const token = await new SignJWT({ rol: usuario.rol })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(usuario.id))
    .setIssuedAt()
    .setExpirationTime(recordar ? '30d' : '12h')
    .sign(secreto());
  const partes = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') partes.push('Secure');
  if (recordar) partes.push(`Max-Age=${30 * 86400}`);
  res.setHeader('Set-Cookie', partes.join('; '));
}

export function cerrarSesion(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function leerCookie(req) {
  for (const parte of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}

// Devuelve el usuario de la sesión (consultando la BD para respetar cuentas desactivadas) o null.
export async function usuarioActual(req) {
  const token = leerCookie(req);
  if (!token) return null;
  const clave = secreto();
  let payload;
  try {
    ({ payload } = await jwtVerify(token, clave));
  } catch {
    return null;
  }
  const [u] = await q('select id, nombre, email, rol from usuarios where id = $1 and activo', [Number(payload.sub)]);
  return u || null;
}
