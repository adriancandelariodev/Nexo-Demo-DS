import { handler, falla } from '../lib/http.js';
import { q, tx } from '../lib/db.js';
import { hoyMX } from '../lib/fechas.js';
import { str, fecha, ids, validarEnlaces } from '../lib/validar.js';
import { registra, puedeSupervisarA } from '../lib/permisos.js';

const ESTATUS = ['Por hacer', 'En progreso', 'Bloqueado', 'Completado'];
const TIPOS_BLOQUEO = [
  'Accesos / permisos',
  'Dependencia del cliente',
  'Dependencia interna',
  'Técnico / bug',
  'Información faltante',
  'Infraestructura',
];

function leer(body) {
  const titulo = str(body.titulo, 200);
  if (!titulo) falla(400, 'Escribe el nombre de la actividad.');
  let avance = Math.round(Number(body.avance_pct));
  if (!Number.isFinite(avance) || avance < 0 || avance > 100) falla(400, 'El avance debe estar entre 0 y 100.');
  let estatus = body.estatus;
  if (!ESTATUS.includes(estatus)) falla(400, 'Estatus no válido.');
  if (avance === 100) estatus = 'Completado';
  if (estatus === 'Completado') avance = 100;

  const fecha_inicio = fecha(body.fecha_inicio);
  const fecha_vencimiento = fecha(body.fecha_vencimiento);
  if (fecha_inicio && fecha_vencimiento && fecha_vencimiento < fecha_inicio) {
    falla(400, 'La fecha fin no puede ser anterior a la fecha de inicio.');
  }

  let bloqueo = null;
  if (estatus === 'Bloqueado') {
    const b = body.bloqueo || {};
    const descripcion = str(b.descripcion, 500);
    if (!descripcion) falla(400, 'Describe el bloqueo para que tu líder sepa qué lo detiene.');
    bloqueo = {
      tipo: TIPOS_BLOQUEO.includes(b.tipo) ? b.tipo : TIPOS_BLOQUEO[0],
      descripcion,
      externo: str(b.responsable_externo, 200),
    };
  }

  return {
    titulo,
    descripcion: str(body.descripcion, 4000),
    siguiente: str(body.siguiente_accion, 500),
    estatus,
    avance,
    fecha_inicio,
    fecha_vencimiento,
    bloqueo,
    enlaces: validarEnlaces(body.enlaces),
    eliminar: ids(body.enlaces_eliminar),
  };
}

// Historial de una actividad: avances, bloqueos, aprobación y devoluciones.
async function historial(id, user) {
  const [a] = await q(
    `select a.id, a.titulo, a.responsable_id, r.nombre as responsable, a.creada_en,
            a.revisada, a.revisada_en, a.revisada_por, v.nombre as revisor
       from actividades a
       join usuarios r on r.id = a.responsable_id
       left join usuarios v on v.id = a.revisada_por
      where a.id = $1`,
    [id]
  );
  const visible = a && (a.responsable_id === user.id || (await puedeSupervisarA(user, a.responsable_id)));
  if (!visible) falla(404, 'No encontramos esa actividad.');

  const [avances, bloqueos, avisos] = await Promise.all([
    q(
      `select v.creado_en, v.usuario_id, u.nombre, v.estatus, v.avance_pct, v.descripcion
         from avances v join usuarios u on u.id = v.usuario_id
        where v.actividad_id = $1 order by v.creado_en`,
      [id]
    ),
    q(
      `select b.tipo, b.descripcion, b.abierto_en, b.resuelto_en, b.resuelto_por, u.nombre as resolvio
         from bloqueos b left join usuarios u on u.id = b.resuelto_por
        where b.actividad_id = $1`,
      [id]
    ),
    // Avisos ligados a la actividad; los anteriores a la v2 se reconocen por el título en el mensaje.
    q(
      `select r.creado_en, r.de_id, u.nombre, r.tipo, r.nota
         from recordatorios r join usuarios u on u.id = r.de_id
        where r.actividad_id = $1
           or (r.actividad_id is null and r.para_id = $2 and r.mensaje like '%«' || $3 || '»%')`,
      [id, a.responsable_id, a.titulo]
    ),
  ]);

  const eventos = [{ fecha: a.creada_en, usuario_id: a.responsable_id, quien: a.responsable, texto: 'creó la actividad' }];
  let descAnterior = '';
  for (const v of avances) {
    eventos.push({
      fecha: v.creado_en,
      usuario_id: v.usuario_id,
      quien: v.nombre,
      texto: `registró avance · ${v.estatus} · ${v.avance_pct}%`,
      detalle: v.descripcion && v.descripcion !== descAnterior ? v.descripcion : '',
    });
    descAnterior = v.descripcion;
  }
  for (const b of bloqueos) {
    eventos.push({ fecha: b.abierto_en, usuario_id: a.responsable_id, quien: a.responsable, texto: `reportó un bloqueo · ${b.tipo}`, detalle: b.descripcion, tipo: 'bloqueo' });
    if (b.resuelto_en) {
      eventos.push({ fecha: b.resuelto_en, usuario_id: b.resuelto_por, quien: b.resolvio || a.responsable, texto: 'resolvió el bloqueo', tipo: 'ok' });
    }
  }
  for (const d of avisos) {
    const pide = d.tipo === 'actualizacion';
    eventos.push({
      fecha: d.creado_en,
      usuario_id: d.de_id,
      quien: d.nombre,
      texto: pide ? 'pidió una actualización' : 'devolvió la actividad para ajustes',
      detalle: d.nota,
      tipo: pide ? 'aviso' : 'bloqueo',
    });
  }
  if (a.revisada && a.revisada_en) {
    eventos.push({ fecha: a.revisada_en, usuario_id: a.revisada_por, quien: a.revisor, texto: 'aprobó la actividad', tipo: 'ok' });
  }
  eventos.sort((x, y) => new Date(y.fecha) - new Date(x.fecha));
  return { eventos };
}

// GET ?id=: historial · POST: crear actividad · PUT: editar una actividad propia
export default handler(
  ['GET', 'POST', 'PUT'],
  async ({ req, user, body }) => {
    if (req.method === 'GET') return historial(Number(req.query?.id), user);
    if (!registra(user)) falla(403, 'Solo los colaboradores y sublíderes registran actividades.');

    const d = leer(body);
    const hoy = hoyMX();

    return tx(async (q) => {
      let id;

      if (req.method === 'POST') {
        const proyectoId = Number(body.proyecto_id);
        const [asignado] = await q(
          `select 1 from proyectos p
            where p.id = $1 and not p.archivado
              and exists (select 1 from proyecto_miembros m where m.proyecto_id = p.id and m.usuario_id = $2)`,
          [proyectoId, user.id]
        );
        if (!asignado) falla(403, 'No estás asignado a ese proyecto.');
        const [dup] = await q(
          `select 1 from actividades where proyecto_id = $1 and responsable_id = $2 and lower(titulo) = lower($3)`,
          [proyectoId, user.id, d.titulo]
        );
        if (dup) falla(409, 'Ya tienes una actividad con ese nombre. Edítala desde Mis actividades.');
        const rows = await q(
          `insert into actividades (proyecto_id, responsable_id, titulo, descripcion, siguiente_accion, estatus,
                                    avance_pct, fecha_inicio, fecha_vencimiento, cerrada_en)
           values ($1, $2, $3, $4, $5, $6::text, $7, $8, $9, case when $6::text = 'Completado' then now() end)
           returning id`,
          [proyectoId, user.id, d.titulo, d.descripcion, d.siguiente, d.estatus, d.avance, d.fecha_inicio, d.fecha_vencimiento]
        );
        id = rows[0].id;
      } else {
        id = Number(body.id);
        const [a] = await q(`select * from actividades where id = $1 and responsable_id = $2 for update`, [id, user.id]);
        if (!a) falla(404, 'No encontramos esa actividad entre las tuyas.');
        if (d.titulo.toLowerCase() !== a.titulo.toLowerCase()) {
          const [dup] = await q(
            `select 1 from actividades
              where proyecto_id = $1 and responsable_id = $2 and lower(titulo) = lower($3) and id <> $4`,
            [a.proyecto_id, user.id, d.titulo, id]
          );
          if (dup) falla(409, 'Ya tienes otra actividad con ese nombre.');
        }
        const completada = d.estatus === 'Completado';
        const seguiaCompletada = completada && a.estatus === 'Completado';
        await q(
          `update actividades
              set titulo = $2, descripcion = $3, siguiente_accion = $4, estatus = $5, avance_pct = $6,
                  fecha_inicio = $7, fecha_vencimiento = $8, actualizada_en = now(),
                  cerrada_en   = case when $9::boolean then coalesce(cerrada_en, now()) end,
                  revisada     = case when $10::boolean then revisada else false end,
                  revisada_en  = case when $10::boolean then revisada_en end,
                  revisada_por = case when $10::boolean then revisada_por end
            where id = $1`,
          [id, d.titulo, d.descripcion, d.siguiente, d.estatus, d.avance, d.fecha_inicio, d.fecha_vencimiento, completada, seguiaCompletada]
        );
      }

      // Cada guardado queda como un avance del día
      const [avance] = await q(
        `insert into avances (actividad_id, usuario_id, fecha, estatus, avance_pct, descripcion, siguiente_accion)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [id, user.id, hoy, d.estatus, d.avance, d.descripcion, d.siguiente]
      );

      const [abierto] = await q(`select id from bloqueos where actividad_id = $1 and resuelto_en is null limit 1`, [id]);
      if (d.bloqueo) {
        if (abierto) {
          await q(`update bloqueos set tipo = $2, descripcion = $3, responsable_externo = $4 where id = $1`, [
            abierto.id, d.bloqueo.tipo, d.bloqueo.descripcion, d.bloqueo.externo,
          ]);
        } else {
          await q(
            `insert into bloqueos (actividad_id, avance_id, tipo, descripcion, responsable_externo)
             values ($1, $2, $3, $4, $5)`,
            [id, avance.id, d.bloqueo.tipo, d.bloqueo.descripcion, d.bloqueo.externo]
          );
        }
      } else if (abierto) {
        await q(`update bloqueos set resuelto_en = now(), resuelto_por = $2 where id = $1`, [abierto.id, user.id]);
      }

      if (d.eliminar.length) {
        await q(`delete from enlaces where actividad_id = $1 and id = any($2::int[])`, [id, d.eliminar]);
      }
      for (const l of d.enlaces) {
        await q(`insert into enlaces (tipo, url, actividad_id, creado_por) values ($1, $2, $3, $4)`, [l.tipo, l.url, id, user.id]);
      }

      return { id };
    });
  }
);
