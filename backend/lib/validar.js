import { falla } from './http.js';

export const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);

export const fecha = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export const ids = (v) =>
  Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500) : [];

const TIPOS_ENLACE = ['drive', 'excel', 'miro', 'otro'];

export function validarEnlaces(v) {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 20)
    .map((l) => {
      const tipo = String(l?.tipo ?? '').toLowerCase();
      return { tipo: TIPOS_ENLACE.includes(tipo) ? tipo : 'otro', url: str(l?.url, 1000) };
    })
    .filter((l) => {
      try {
        const u = new URL(l.url);
        return u.protocol === 'https:' || u.protocol === 'http:';
      } catch {
        return false;
      }
    });
}

// Si EMAIL_DOMAIN está definido, solo se aceptan correos de ese dominio.
export function dominio() {
  return (process.env.EMAIL_DOMAIN || '').trim().replace(/^@/, '').toLowerCase();
}

export function validarDominio(email) {
  const d = dominio();
  if (d && !email.endsWith('@' + d)) falla(400, `Usa el correo de la empresa, que termina en @${d}.`);
}
