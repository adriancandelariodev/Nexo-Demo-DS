import { handler, falla } from '../lib/http.js';
import { q } from '../lib/db.js';
import { str } from '../lib/validar.js';

// POST (líder): pedir actualización a un colaborador · PUT (colaborador): marcar sus avisos como leídos
export default handler(['POST', 'PUT'], async ({ req, user, body }) => {
  if (req.method === 'POST') {
    if (user.rol !== 'lider') falla(403, 'No tienes permiso para esta acción.');
    const [u] = await q(`select id from usuarios where id = $1 and rol = 'dev' and activo`, [Number(body.usuario_id)]);
    if (!u) falla(404, 'No encontramos a esa persona.');
    await q(`insert into recordatorios (de_id, para_id, mensaje) values ($1, $2, $3)`, [
      user.id,
      u.id,
      str(body.mensaje, 300) || 'Te pidió actualizar el avance de tus actividades.',
    ]);
    return { ok: true };
  }

  await q(`update recordatorios set leido_en = now() where para_id = $1 and leido_en is null`, [user.id]);
  return { ok: true };
});
