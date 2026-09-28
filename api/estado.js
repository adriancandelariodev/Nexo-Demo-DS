import { handler } from '../lib/http.js';
import { q } from '../lib/db.js';
import { hoyMX, addDays, lunesDe, isoWeek, dow, habilesEntre } from '../lib/fechas.js';
import { supervisa, registra, equipoDe } from '../lib/permisos.js';

// Devuelve todo lo que la persona puede ver según su rol:
// - dev: solo lo suyo.
// - sublider: lo suyo + lo de su equipo.
// - lider: todo.
export default handler(['GET'], async ({ user }) => {
  const lider = user.rol === 'lider';
  const equipo = await equipoDe(user);
  // vis = responsables visibles (null = todos); eqParam = equipo supervisado (null = todos, [] = nadie)
  const vis = lider ? null : [user.id, ...equipo];
  const eqParam = lider ? null : equipo;

  const hoy = hoyMX();
  // Semana ISO completa (lunes a domingo) que contiene el día de hoy.
  const lunes = lunesDe(hoy);
  const domingo = addDays(lunes, 6);
  const d = dow(hoy);
  const semana = { num: isoWeek(hoy), ini: lunes, fin: domingo, hoy, habiles: d === 0 || d === 6 ? 5 : d };

  const [proyectos, actividades, bloqueos, feed] = await Promise.all([
    q(
      `select p.id, p.nombre, p.cliente_id, c.nombre as cliente, p.responsable_id, r.nombre as responsable,
              p.fecha_inicio, p.fecha_compromiso,
              count(a.id)::int as total,
              (count(a.id) filter (where a.estatus = 'Completado'))::int as cerradas,
              (count(a.id) filter (where a.estatus = 'Bloqueado'))::int as bloqueadas,
              (count(a.id) filter (where a.estatus <> 'Por hacer'))::int as iniciadas,
              coalesce((select array_agg(m.usuario_id order by m.usuario_id)
                        from proyecto_miembros m where m.proyecto_id = p.id), '{}') as miembros,
              exists (select 1 from proyecto_miembros m where m.proyecto_id = p.id and m.usuario_id = $2) as soy_miembro,
              ($3::int[] is null
               or exists (select 1 from proyecto_miembros m where m.proyecto_id = p.id and m.usuario_id = any($3))
               or exists (select 1 from actividades x where x.proyecto_id = p.id and x.responsable_id = any($3))) as del_equipo
         from proyectos p
         join clientes c on c.id = p.cliente_id
         left join usuarios r on r.id = p.responsable_id
         left join actividades a on a.proyecto_id = p.id
        where not p.archivado
          and ($1::int[] is null
               or exists (select 1 from proyecto_miembros m where m.proyecto_id = p.id and m.usuario_id = any($1))
               or exists (select 1 from actividades x where x.proyecto_id = p.id and x.responsable_id = any($1)))
        group by p.id, c.nombre, r.nombre
        order by p.fecha_compromiso nulls last, p.id`,
      [vis, user.id, eqParam]
    ),
    q(
      `select a.id, a.proyecto_id, a.responsable_id, u.nombre as responsable, a.titulo, a.descripcion,
              a.siguiente_accion, a.estatus, a.avance_pct, a.fecha_inicio, a.fecha_vencimiento,
              a.revisada, a.cerrada_en, a.actualizada_en
         from actividades a
         join usuarios u on u.id = a.responsable_id
         join proyectos p on p.id = a.proyecto_id
        where not p.archivado and ($1::int[] is null or a.responsable_id = any($1))
        order by a.fecha_vencimiento nulls last, a.id`,
      [vis]
    ),
    q(
      `select b.id, b.actividad_id, a.titulo as actividad, a.proyecto_id, c.nombre as cliente, p.nombre as proyecto,
              a.responsable_id, u.nombre as responsable, b.tipo, b.descripcion, b.responsable_externo, b.abierto_en,
              ((now() at time zone 'America/Mexico_City')::date
                - (b.abierto_en at time zone 'America/Mexico_City')::date)::int as dias
         from bloqueos b
         join actividades a on a.id = b.actividad_id
         join usuarios u on u.id = a.responsable_id
         join proyectos p on p.id = a.proyecto_id
         join clientes c on c.id = p.cliente_id
        where b.resuelto_en is null and not p.archivado and ($1::int[] is null or a.responsable_id = any($1))
        order by b.abierto_en`,
      [vis]
    ),
    q(
      `select v.id, v.usuario_id, u.nombre as usuario, v.creado_en, v.fecha, v.estatus, v.avance_pct,
              a.titulo, c.nombre as cliente
         from avances v
         join usuarios u on u.id = v.usuario_id
         join actividades a on a.id = v.actividad_id
         join proyectos p on p.id = a.proyecto_id
         join clientes c on c.id = p.cliente_id
        where ($1::int[] is null or v.usuario_id = any($1))
        order by v.creado_en desc
        limit 60`,
      [vis]
    ),
  ]);

  const ids = proyectos.map((p) => p.id);
  const enlaces = ids.length
    ? await q(
        `select e.id, e.tipo, e.url, e.titulo, e.proyecto_id, e.actividad_id
           from enlaces e
           left join actividades a on a.id = e.actividad_id
          where e.proyecto_id = any($1::int[])
             or (a.proyecto_id = any($1::int[]) and ($2::int[] is null or a.responsable_id = any($2)))
          order by e.id`,
        [ids, vis]
      )
    : [];

  for (const p of proyectos) {
    p.pct = p.total ? Math.round((p.cerradas / p.total) * 100) : 0;
    p.estatus = p.bloqueadas
      ? 'Bloqueado'
      : p.total && p.cerradas === p.total
        ? 'Completado'
        : p.iniciadas
          ? 'En progreso'
          : 'Por hacer';
    p.enlaces = enlaces.filter((e) => e.proyecto_id === p.id);
    if (!supervisa(user)) p.miembros = [];
  }
  for (const a of actividades) a.enlaces = enlaces.filter((e) => e.actividad_id === a.id);

  let out = { me: user, hoy, semana, proyectos, actividades, bloqueos, feed };

  if (registra(user)) {
    const [recordatorios, [jefe]] = await Promise.all([
      q(
        `select r.id, r.mensaje, r.nota, r.tipo, r.actividad_id, r.creado_en, u.nombre as de
           from recordatorios r join usuarios u on u.id = r.de_id
          where r.para_id = $1 and r.leido_en is null
          order by r.creado_en desc limit 10`,
        [user.id]
      ),
      // Quien revisa su trabajo: su sublíder si tiene uno activo; si no, la líder.
      q(
        `select coalesce(
           (select s.nombre from usuarios u join usuarios s on s.id = u.sublider_id and s.activo where u.id = $1),
           (select nombre from usuarios where rol = 'lider' and activo order by id limit 1)) as nombre`,
        [user.id]
      ),
    ]);
    out = { ...out, recordatorios, lider: jefe ? jefe.nombre : null };
  }
  if (!supervisa(user)) return out;

  const cerradasEn = (a, b) =>
    q(
      `select count(*)::int as n from actividades
        where cerrada_en is not null and responsable_id = any($3)
          and (cerrada_en at time zone 'America/Mexico_City')::date between $1 and $2`,
      [a, b, equipo]
    ).then((r) => r[0].n);

  const [personas, cerradas, cerradasPrev, [nuevos], [resol], usuarios, clientes, archivados] = await Promise.all([
    q(
      `select u.id, u.nombre, u.email, u.rol, u.sublider_id,
              (select count(distinct v.fecha) from avances v
                where v.usuario_id = u.id and v.fecha between $1 and $2
                  and extract(isodow from v.fecha) < 6)::int as dias,
              (select count(*) from actividades a
                where a.responsable_id = u.id and a.cerrada_en is not null
                  and (a.cerrada_en at time zone 'America/Mexico_City')::date between $1 and $2)::int as cerradas,
              (select count(*) from bloqueos b join actividades a on a.id = b.actividad_id
                where a.responsable_id = u.id and b.resuelto_en is null)::int as bloqueos,
              (select max(v.fecha) from avances v where v.usuario_id = u.id) as ultimo_avance
         from usuarios u
        where u.id = any($3)
        order by u.nombre`,
      [lunes, domingo, equipo]
    ),
    cerradasEn(lunes, domingo),
    cerradasEn(addDays(lunes, -7), addDays(domingo, -7)),
    q(
      `select count(*)::int as n from avances
        where usuario_id = any($2) and creado_en >= $1::date::timestamp at time zone 'America/Mexico_City'`,
      [addDays(hoy, -1), equipo]
    ),
    q(
      `select round((avg(extract(epoch from b.resuelto_en - b.abierto_en)) / 86400)::numeric, 1) as dias
         from bloqueos b join actividades a on a.id = b.actividad_id
        where b.resuelto_en >= date_trunc('month', now()) and a.responsable_id = any($1)`,
      [equipo]
    ),
    lider ? q(`select id, nombre, email, rol, activo, sublider_id from usuarios order by rol desc, nombre`) : [],
    lider ? q(`select id, nombre from clientes order by nombre`) : [],
    lider
      ? q(
          `select p.id, p.nombre, c.nombre as cliente
             from proyectos p join clientes c on c.id = p.cliente_id
            where p.archivado order by p.id desc`
        )
      : [],
  ]);

  const enEquipo = new Set(equipo);
  const actsEq = actividades.filter((a) => enEquipo.has(a.responsable_id));
  const bloqEq = bloqueos.filter((b) => enEquipo.has(b.responsable_id));
  const vencida = (a) => a.estatus !== 'Completado' && a.fecha_vencimiento && a.fecha_vencimiento < hoy;

  // Reglas automáticas de riesgo, sobre el trabajo del equipo supervisado
  const alertas = [];
  for (const p of proyectos.filter((x) => x.del_equipo)) {
    const bl = bloqEq.filter((b) => b.proyecto_id === p.id);
    const venc = actsEq.filter((a) => a.proyecto_id === p.id && vencida(a));
    const detalle = [];
    let critico = false;
    if (bl.length) {
      const viejo = Math.max(...bl.map((b) => b.dias));
      if (viejo >= 5) critico = true;
      detalle.push(
        bl.length === 1
          ? `Bloqueo por ${bl[0].tipo.toLowerCase()} abierto hace ${viejo} ${viejo === 1 ? 'día' : 'días'}`
          : `${bl.length} bloqueos abiertos, el más antiguo de ${viejo} días`
      );
    }
    if (venc.length) {
      if (bl.length) critico = true;
      detalle.push(venc.length === 1 ? `Actividad vencida: ${venc[0].titulo}` : `${venc.length} actividades vencidas`);
    }
    if (p.fecha_compromiso && p.pct < 100) {
      const faltan = Math.round((new Date(p.fecha_compromiso) - new Date(hoy)) / 864e5);
      if (faltan < 0) {
        critico = true;
        detalle.push(`Compromiso vencido hace ${-faltan} ${faltan === -1 ? 'día' : 'días'}`);
      } else if (faltan <= 3) {
        detalle.push(`Compromiso en ${faltan} ${faltan === 1 ? 'día' : 'días'} con ${p.pct}% de avance`);
      }
    }
    if (detalle.length) {
      alertas.push({ proyecto_id: p.id, titulo: p.cliente, detalle: detalle.join(' · '), sev: critico ? 'Crítico' : 'Atención' });
    }
  }
  for (const u of personas) {
    const abiertas = actsEq.some((a) => a.responsable_id === u.id && a.estatus !== 'Completado');
    if (!abiertas) continue;
    if (!u.ultimo_avance || habilesEntre(u.ultimo_avance, hoy) >= 2) {
      alertas.push({
        usuario_id: u.id,
        titulo: u.nombre,
        detalle: u.ultimo_avance
          ? `Sin registrar avance desde el ${u.ultimo_avance.slice(8, 10)}/${u.ultimo_avance.slice(5, 7)}`
          : 'Aún no registra avances',
        sev: 'Atención',
      });
    }
  }
  alertas.sort((a, b) => (a.sev === b.sev ? 0 : a.sev === 'Crítico' ? -1 : 1));

  const kpis = {
    avances: personas.reduce((n, p) => n + p.dias, 0),
    esperados: personas.length * semana.habiles,
    cerradas,
    cerradas_prev: cerradasPrev,
    semana_prev: isoWeek(addDays(lunes, -7)),
    nuevos: nuevos.n,
    resolucion_dias: resol.dias == null ? null : Number(resol.dias),
  };

  return { ...out, personas, kpis, alertas, usuarios, clientes, archivados };
});
