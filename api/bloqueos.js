import { handler, falla } from '../lib/http.js';
import { tx } from '../lib/db.js';
import { hoyMX } from '../lib/fechas.js';

// El colaborador marca como resuelto uno de sus bloqueos
export default handler(
  ['POST'],
  async ({ user, body }) =>
    tx(async (q) => {
      const [b] = await q(
        `update bloqueos b set resuelto_en = now(), resuelto_por = $2
           from actividades a
          where b.id = $1 and a.id = b.actividad_id and a.responsable_id = $2 and b.resuelto_en is null
      returning b.actividad_id`,
        [Number(body.id), user.id]
      );
      if (!b) falla(404, 'Ese bloqueo ya no está abierto.');

      const [a] = await q(
        `update actividades set estatus = 'En progreso', actualizada_en = now()
          where id = $1 and estatus = 'Bloqueado'
      returning id, estatus, avance_pct, siguiente_accion`,
        [b.actividad_id]
      );
      if (a) {
        await q(
          `insert into avances (actividad_id, usuario_id, fecha, estatus, avance_pct, descripcion, siguiente_accion)
           values ($1, $2, $3, $4, $5, 'Bloqueo resuelto', $6)`,
          [a.id, user.id, hoyMX(), a.estatus, a.avance_pct, a.siguiente_accion]
        );
      }
      return { ok: true };
    }),
  { rol: 'dev' }
);
