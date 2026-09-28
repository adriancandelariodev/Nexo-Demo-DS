import { usuarioActual } from './auth.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function falla(status, message) {
  throw new HttpError(status, message);
}

// Envuelve una función de API: método permitido, sesión, rol y manejo de errores.
export function handler(metodos, fn, { auth = true, rol = null } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (!metodos.includes(req.method)) {
        res.setHeader('Allow', metodos.join(', '));
        return res.status(405).json({ error: 'Método no permitido.' });
      }
      let user = null;
      if (auth) {
        user = await usuarioActual(req);
        if (!user) return res.status(401).json({ error: 'Tu sesión terminó. Inicia sesión de nuevo.' });
        if (rol && user.rol !== rol) return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
      }
      let body = {};
      if (req.method !== 'GET') {
        try {
          body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
        } catch {
          falla(400, 'Solicitud no válida.');
        }
      }
      const out = await fn({ req, res, user, body });
      if (!res.headersSent) res.status(200).json(out ?? { ok: true });
    } catch (err) {
      if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
      if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos.' });
      if (err.code === '23503') return res.status(400).json({ error: 'Uno de los datos hace referencia a algo que no existe.' });
      console.error(err);
      return res.status(500).json({ error: 'Error del servidor. Inténtalo de nuevo.' });
    }
  };
}
