import { handler, falla } from '../lib/http.js';
import { q } from '../lib/db.js';
import { str } from '../lib/validar.js';
import { supervisa, puedeSupervisarA } from '../lib/permisos.js';

// POST (líder): pedir actualización a un colaborador, opcionalmente sobre una actividad
// PUT (colaborador): marcar sus avisos como leídos
export default handler(['POST', 'PUT'], async ({ req, user, body }) => {
  if (req.method === 'POST') {
    if (!supervisa(user)) falla(403, 'No tienes permiso para esta acción.');
    const [u] = await q(`select id from usuarios where id = $1 and activo`, [Number(body.usuario_id)]);
    if (!u) falla(404, 'No encontramos a esa persona.');
    if (!(await puedeSupervisarA(user, u.id))) falla(403, 'Esa persona no es de tu equipo.');
    const nota = str(body.mensaje, 500);
    if (!nota) falla(400, 'Escribe qué necesitas que actualice.');

    let actividad = null;
    if (body.actividad_id) {
      [actividad] = await q(`select id, titulo from actividades where id = $1 and responsable_id = $2`, [Number(body.actividad_id), u.id]);
      if (!actividad) falla(404, 'No encontramos esa actividad.');
    }
    await q(
      `insert into recordatorios (de_id, para_id, mensaje, actividad_id, tipo, nota) values ($1, $2, $3, $4, 'actualizacion', $5)`,
      [
        user.id,
        u.id,
        actividad ? `Te pidió actualizar «${actividad.titulo}».` : 'Te pidió actualizar el avance de tus actividades.',
        actividad ? actividad.id : null,
        nota,
      ]
    );
    return { ok: true };
  }

  await q(`update recordatorios set leido_en = now() where para_id = $1 and leido_en is null`, [user.id]);
  return { ok: true };
});
