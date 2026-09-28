import { handler, falla } from '../lib/http.js';
import { q, tx } from '../lib/db.js';
import { str } from '../lib/validar.js';
import { supervisa, puedeSupervisarA } from '../lib/permisos.js';

// La líder (cualquier actividad) o el sublíder (las de su equipo) aprueba o devuelve una actividad completada
export default handler(['POST'], async ({ user, body }) => {
  if (!supervisa(user)) falla(403, 'No tienes permiso para esta acción.');
  const id = Number(body.actividad_id);

  const [act] = await q(`select responsable_id from actividades where id = $1`, [id]);
  if (!act) falla(404, 'No encontramos esa actividad.');
  if (act.responsable_id === user.id) falla(403, 'Tus propias actividades las revisa la líder.');
  if (!(await puedeSupervisarA(user, act.responsable_id))) falla(403, 'Esa actividad no es de tu equipo.');

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
    const motivo = str(body.motivo, 500);
    if (!motivo) falla(400, 'Escribe por qué devuelves la actividad.');
    return tx(async (tq) => {
      const [a] = await tq(
        `update actividades
            set estatus = 'En progreso', avance_pct = 90, revisada = false, revisada_en = null,
                revisada_por = null, cerrada_en = null, actualizada_en = now()
          where id = $1 and estatus = 'Completado'
      returning id, responsable_id, titulo`,
        [id]
      );
      if (!a) falla(404, 'Esa actividad ya no está pendiente de revisión.');
      await tq(
        `insert into recordatorios (de_id, para_id, mensaje, actividad_id, tipo, nota) values ($1, $2, $3, $4, 'devolucion', $5)`,
        [user.id, a.responsable_id, `Devolvió «${a.titulo}» para ajustes.`, a.id, motivo]
      );
      return { ok: true };
    });
  }

  falla(400, 'Acción no válida.');
});
