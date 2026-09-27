import { handler, falla } from '../lib/http.js';
import { q, tx } from '../lib/db.js';
import { str } from '../lib/validar.js';

// El líder aprueba o devuelve una actividad completada
export default handler(
  ['POST'],
  async ({ user, body }) => {
    const id = Number(body.actividad_id);

    if (body.accion === 'aprobar') {
      const [a] = await q(
        `update actividades set revisada = true, revisada_en = now(), revisada_por = $2
          where id = $1 and estatus = 'Completado' returning id`,
        [id, user.id]
      );
      if (!a) falla(404, 'Esa actividad ya no está pendiente de revisión.');
      return { ok: true };
    }

    if (body.accion === 'devolver') {
      const motivo = str(body.motivo, 300);
      return tx(async (tq) => {
        const [a] = await tq(
          `update actividades
              set estatus = 'En progreso', avance_pct = 90, revisada = false, revisada_en = null,
                  revisada_por = null, cerrada_en = null, actualizada_en = now()
            where id = $1 and estatus = 'Completado'
        returning responsable_id, titulo`,
          [id]
        );
        if (!a) falla(404, 'Esa actividad ya no está pendiente de revisión.');
        await tq(`insert into recordatorios (de_id, para_id, mensaje) values ($1, $2, $3)`, [
          user.id,
          a.responsable_id,
          `Devolvió «${a.titulo}» para ajustes.` + (motivo ? ` ${motivo}` : ''),
        ]);
        return { ok: true };
      });
    }

    falla(400, 'Acción no válida.');
  },
  { rol: 'lider' }
);
