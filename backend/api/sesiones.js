import { handler } from '../lib/http.js';
import { q } from '../lib/db.js';
import { equipoDe } from '../lib/permisos.js';

// GET: sesiones de Google Meet analizadas por n8n, métricas de comunicación y alertas de la IA.
//   Líder: todo el equipo · Sublíder: su equipo y él mismo · Colaborador: solo lo suyo
//   (cada colaborador ve sus propias métricas y observaciones).
export default handler(['GET'], async ({ user }) => {
  const lider = user.rol === 'lider';
  const alcance = lider ? null : [user.id, ...(await equipoDe(user))];

  const sesiones = await q(
    `select s.id, s.titulo, s.inicio, s.duracion_min, s.resumen, s.acuerdos, s.cita,
            p.nombre as proyecto, c.nombre as cliente
       from sesiones s
       left join proyectos p on p.id = s.proyecto_id
       left join clientes c on c.id = p.cliente_id
      where s.inicio >= now() - interval '45 days'
        and ($1::int[] is null or exists (
              select 1 from participaciones x where x.sesion_id = s.id and x.usuario_id = any($1::int[])))
      order by s.inicio desc
      limit 200`,
    [alcance]
  );
  const ids = sesiones.map((s) => s.id);

  const participaciones = ids.length
    ? await q(
        `select sesion_id, usuario_id, nombre, pct_voz::float as pct_voz, palabras, intervenciones,
                actualizacion_completa, menciono_bloqueo, observacion
           from participaciones
          where sesion_id = any($1::int[]) and ($2::int[] is null or usuario_id = any($2::int[]))
          order by pct_voz desc`,
        [ids, alcance]
      )
    : [];

  const compromisos = ids.length
    ? await q(
        `select compromiso_id as id, sesion_id, usuario_id, responsable, descripcion, fecha_limite, estado
           from ia_compromisos
          where sesion_id = any($1::int[]) and ($2::int[] is null or usuario_id = any($2::int[]))
          order by fecha_limite nulls last`,
        [ids, alcance]
      )
    : [];

  // Métricas de los últimos 30 días por persona
  const metricas = await q(
    `select u.id as usuario_id, u.nombre,
            count(x.id)::int as sesiones,
            round(avg(x.pct_voz), 1)::float as pct_voz_promedio,
            count(x.id) filter (where x.actualizacion_completa)::int as actualizaciones_completas,
            count(x.id) filter (where x.actualizacion_completa is not null)::int as actualizaciones_evaluadas,
            count(x.id) filter (where x.menciono_bloqueo)::int as bloqueos_mencionados,
            (select count(*) from compromisos k join sesiones s2 on s2.id = k.sesion_id
              where k.usuario_id = u.id and k.cumplido and s2.inicio >= now() - interval '30 days')::int as compromisos_cumplidos,
            (select count(*) from compromisos k join sesiones s2 on s2.id = k.sesion_id
              where k.usuario_id = u.id and s2.inicio >= now() - interval '30 days'
                and (k.cumplido or k.fecha_limite < nexo_hoy()))::int as compromisos_evaluables
       from usuarios u
       left join participaciones x on x.usuario_id = u.id
            and x.sesion_id in (select id from sesiones where inicio >= now() - interval '30 days')
      where u.activo and u.rol in ('dev', 'sublider')
        and ($1::int[] is null or u.id = any($1::int[]))
      group by u.id
      order by u.nombre`,
    [alcance]
  );

  const alertas = user.rol === 'dev'
    ? []
    : await q(
        `select a.id, a.usuario_id, u.nombre, a.nivel, a.titulo, a.detalle, a.fecha
           from alertas_ia a left join usuarios u on u.id = a.usuario_id
          where a.fecha = (select max(fecha) from alertas_ia)
            and ($1::int[] is null or a.usuario_id = any($1::int[]))
          order by case a.nivel when 'alta' then 0 when 'media' then 1 else 2 end, a.id`,
        [alcance]
      );

  return {
    sesiones,
    participaciones,
    compromisos,
    metricas,
    alertas,
    asistente: lider && !!process.env.N8N_ASISTENTE_URL,
  };
});
