import bcrypt from 'bcryptjs';
import { handler, falla } from '../lib/http.js';
import { q } from '../lib/db.js';
import { crearSesion, cerrarSesion, usuarioActual } from '../lib/auth.js';
import { validarDominio } from '../lib/validar.js';

// GET: sesión actual · POST: iniciar sesión · DELETE: cerrar sesión
export default handler(
  ['GET', 'POST', 'DELETE'],
  async ({ req, res, body }) => {
    if (req.method === 'GET') {
      const usuario = await usuarioActual(req);
      if (!usuario) falla(401, 'Sin sesión.');
      return { usuario };
    }
    if (req.method === 'DELETE') {
      cerrarSesion(res);
      return { ok: true };
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) falla(400, 'Escribe tu correo y tu contraseña.');
    validarDominio(email);

    const [u] = await q(
      'select id, nombre, email, rol, password_hash from usuarios where email = $1 and activo',
      [email]
    );
    const ok = u ? await bcrypt.compare(password, u.password_hash) : false;
    if (!ok) falla(401, 'El correo o la contraseña no coinciden. Revisa e inténtalo de nuevo.');

    await crearSesion(res, u, !!body.recordar);
    return { usuario: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol } };
  },
  { auth: false }
);
