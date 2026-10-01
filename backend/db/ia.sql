-- Nexo · IA con n8n (sesiones de Google Meet, asistente, reporte semanal y detector de riesgos)
-- Se ejecuta después de schema.sql (npm run db:setup lo corre solo). Se puede ejecutar varias veces.
--
-- n8n NUNCA escribe directo en las tablas: solo lee las vistas ia_* y llama a las funciones nexo_guardar_*.
-- Los usuarios de base de datos para n8n se crean aparte con db/n8n-acceso.sql.

-- Nombre con el que la persona aparece en Google Meet, si no coincide con su nombre en Nexo
alter table usuarios add column if not exists nombre_meet text not null default '';

create table if not exists sesiones (
  id               serial primary key,
  calendar_id      text not null unique,          -- id del evento en Google Calendar
  titulo           text not null,
  inicio           timestamptz not null,
  fin              timestamptz,
  duracion_min     int,
  proyecto_id      int references proyectos(id) on delete set null,
  transcripcion_id text not null default '',      -- id del Google Doc de la transcripción
  resumen          text not null default '',
  acuerdos         jsonb not null default '[]',
  cita             text not null default '',
  asistentes       jsonb not null default '[]',
  procesada_en     timestamptz not null default now()
);
create index if not exists sesiones_inicio on sesiones (inicio desc);

create table if not exists participaciones (
  id                     serial primary key,
  sesion_id              int not null references sesiones(id) on delete cascade,
  usuario_id             int references usuarios(id) on delete set null,  -- null = persona externa
  nombre                 text not null,                                   -- como aparece en Meet
  palabras               int not null default 0,
  pct_voz                numeric(5,2) not null default 0,                 -- % de palabras de la sesión
  intervenciones         int not null default 0,
  actualizacion_completa boolean,   -- dio estatus + dato concreto + siguiente paso (null = no reportó)
  menciono_bloqueo       boolean,
  observacion            text not null default '',
  unique (sesion_id, nombre)
);
create index if not exists participaciones_usuario on participaciones (usuario_id);

create table if not exists compromisos (
  id                 serial primary key,
  sesion_id          int not null references sesiones(id) on delete cascade,
  usuario_id         int references usuarios(id) on delete set null,
  responsable        text not null,
  descripcion        text not null,
  fecha_limite       date,
  cumplido           boolean,
  cumplido_en_sesion int references sesiones(id) on delete set null
);
create index if not exists compromisos_usuario on compromisos (usuario_id);

create table if not exists alertas_ia (
  id         serial primary key,
  usuario_id int references usuarios(id) on delete cascade,
  nivel      text not null default 'media' check (nivel in ('alta', 'media', 'baja')),
  titulo     text not null,
  detalle    text not null default '',
  fecha      date not null,
  creada_en  timestamptz not null default now()
);
create index if not exists alertas_ia_fecha on alertas_ia (fecha desc);

/* ---------- utilidades ---------- */

create or replace function nexo_hoy() returns date
language sql stable as $$ select (now() at time zone 'America/Mexico_City')::date $$;

-- minúsculas, sin acentos y sin espacios dobles: "  Ana  Ríos" → "ana rios"
create or replace function nexo_norm(t text) returns text
language sql immutable as $$
  select regexp_replace(lower(translate(coalesce(t, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '\s+', ' ', 'g')
$$;

-- Busca al usuario de Nexo por el nombre que aparece en Meet.
-- 1) nombre_meet exacto · 2) nombre exacto · 3) mismo primer nombre y mismo último apellido
create or replace function nexo_usuario_por_nombre(n text) returns int
language sql stable as $$
  with x as (select trim(nexo_norm(n)) as n)
  select u.id
  from usuarios u, x
  where u.activo and x.n <> ''
    and (
      nexo_norm(u.nombre_meet) = x.n
      or trim(nexo_norm(u.nombre)) = x.n
      or (split_part(trim(nexo_norm(u.nombre)), ' ', 1) = split_part(x.n, ' ', 1)
          and x.n like '% ' || reverse(split_part(reverse(trim(nexo_norm(u.nombre))), ' ', 1)))
    )
  order by (nexo_norm(u.nombre_meet) = x.n) desc, (trim(nexo_norm(u.nombre)) = x.n) desc, u.id
  limit 1
$$;

/* ---------- vistas que lee la IA (solo lectura) ---------- */

create or replace view ia_personas as
select id as usuario_id, nombre, email, rol
from usuarios
where activo and rol in ('dev', 'sublider');

create or replace view ia_proyectos as
select p.id as proyecto_id, p.nombre as proyecto, c.nombre as cliente, r.nombre as responsable,
       p.fecha_inicio, p.fecha_compromiso, p.archivado,
       coalesce(round(avg(a.avance_pct)), 0)::int as avance_promedio_pct
from proyectos p
join clientes c on c.id = p.cliente_id
left join usuarios r on r.id = p.responsable_id
left join actividades a on a.proyecto_id = p.id
group by p.id, c.nombre, r.nombre;

create or replace view ia_actividades as
select a.id as actividad_id, p.nombre as proyecto, c.nombre as cliente,
       a.responsable_id as usuario_id, u.nombre as responsable,
       a.titulo, a.estatus, a.avance_pct, a.fecha_inicio, a.fecha_vencimiento,
       (a.estatus <> 'Completado' and a.fecha_vencimiento < nexo_hoy()) as vencida,
       (select max(v.fecha) from avances v where v.actividad_id = a.id) as ultimo_avance,
       a.descripcion, a.siguiente_accion, a.revisada,
       (a.cerrada_en at time zone 'America/Mexico_City')::date as cerrada_el
from actividades a
join proyectos p on p.id = a.proyecto_id
join clientes c on c.id = p.cliente_id
join usuarios u on u.id = a.responsable_id;

create or replace view ia_avances as
select v.fecha, v.usuario_id, u.nombre as responsable, a.titulo as actividad, p.nombre as proyecto,
       v.estatus, v.avance_pct, v.descripcion, v.siguiente_accion
from avances v
join actividades a on a.id = v.actividad_id
join proyectos p on p.id = a.proyecto_id
join usuarios u on u.id = v.usuario_id
where v.fecha >= nexo_hoy() - 120;

create or replace view ia_bloqueos as
select b.id as bloqueo_id, a.responsable_id as usuario_id, u.nombre as responsable,
       a.titulo as actividad, p.nombre as proyecto, b.tipo, b.descripcion, b.responsable_externo,
       (b.abierto_en at time zone 'America/Mexico_City')::date as abierto_el,
       (b.resuelto_en at time zone 'America/Mexico_City')::date as resuelto_el,
       (b.resuelto_en is null) as abierto,
       (coalesce((b.resuelto_en at time zone 'America/Mexico_City')::date, nexo_hoy())
         - (b.abierto_en at time zone 'America/Mexico_City')::date) as dias_abierto
from bloqueos b
join actividades a on a.id = b.actividad_id
join proyectos p on p.id = a.proyecto_id
join usuarios u on u.id = a.responsable_id;

create or replace view ia_sesiones as
select s.id as sesion_id, s.titulo, s.inicio, (s.inicio at time zone 'America/Mexico_City')::date as fecha,
       s.duracion_min, p.nombre as proyecto, s.resumen, s.acuerdos, s.cita,
       (select count(*) from participaciones x where x.sesion_id = s.id) as participantes,
       s.calendar_id
from sesiones s
left join proyectos p on p.id = s.proyecto_id;

create or replace view ia_participaciones as
select x.sesion_id, s.titulo as sesion, (s.inicio at time zone 'America/Mexico_City')::date as fecha,
       x.usuario_id, x.nombre as persona, (x.usuario_id is null) as externo,
       x.pct_voz, x.palabras, x.intervenciones, x.actualizacion_completa, x.menciono_bloqueo, x.observacion
from participaciones x
join sesiones s on s.id = x.sesion_id;

create or replace view ia_compromisos as
select k.id as compromiso_id, k.sesion_id, s.titulo as sesion,
       (s.inicio at time zone 'America/Mexico_City')::date as fecha_sesion,
       k.usuario_id, k.responsable, k.descripcion, k.fecha_limite,
       case when k.cumplido then 'Cumplido'
            when k.fecha_limite < nexo_hoy() then 'Vencido'
            else 'Pendiente' end as estado
from compromisos k
join sesiones s on s.id = k.sesion_id;

-- Una fila por colaborador con las métricas de la semana actual (lunes a hoy)
create or replace view ia_rendimiento_semana as
with sem as (select nexo_hoy() as hoy, date_trunc('week', nexo_hoy())::date as lunes)
select u.id as usuario_id, u.nombre, sem.lunes as semana_del,
  (select count(distinct v.fecha) from avances v
     where v.usuario_id = u.id and v.fecha between sem.lunes and least(sem.hoy, sem.lunes + 4)) as dias_con_registro,
  least(sem.hoy, sem.lunes + 4) - sem.lunes + 1 as dias_habiles,
  (select count(*) from actividades a
     where a.responsable_id = u.id and a.estatus = 'Completado'
       and (a.cerrada_en at time zone 'America/Mexico_City')::date >= sem.lunes) as cerradas,
  (select count(*) from actividades a
     where a.responsable_id = u.id and a.estatus <> 'Completado') as abiertas,
  (select count(*) from actividades a
     where a.responsable_id = u.id and a.estatus <> 'Completado' and a.fecha_vencimiento < sem.hoy) as vencidas,
  (select count(*) from bloqueos b join actividades a on a.id = b.actividad_id
     where a.responsable_id = u.id and b.resuelto_en is null) as bloqueos_abiertos,
  (select count(*) from participaciones x join sesiones s on s.id = x.sesion_id
     where x.usuario_id = u.id and (s.inicio at time zone 'America/Mexico_City')::date >= sem.lunes) as sesiones,
  (select round(avg(x.pct_voz), 1) from participaciones x join sesiones s on s.id = x.sesion_id
     where x.usuario_id = u.id and (s.inicio at time zone 'America/Mexico_City')::date >= sem.lunes) as pct_voz_promedio,
  (select count(*) filter (where x.actualizacion_completa) from participaciones x join sesiones s on s.id = x.sesion_id
     where x.usuario_id = u.id and (s.inicio at time zone 'America/Mexico_City')::date >= sem.lunes) as actualizaciones_completas,
  (select count(*) filter (where x.actualizacion_completa is not null) from participaciones x join sesiones s on s.id = x.sesion_id
     where x.usuario_id = u.id and (s.inicio at time zone 'America/Mexico_City')::date >= sem.lunes) as actualizaciones_evaluadas,
  (select count(*) filter (where k.cumplido) from compromisos k
     where k.usuario_id = u.id and k.fecha_limite between sem.lunes and sem.hoy) as compromisos_cumplidos,
  (select count(*) from compromisos k
     where k.usuario_id = u.id and k.fecha_limite between sem.lunes and sem.hoy) as compromisos_con_fecha
from usuarios u, sem
where u.activo and u.rol in ('dev', 'sublider');

-- Riesgos de hoy: una fila por hallazgo. La lee el detector diario.
create or replace view ia_riesgos_hoy as
select a.usuario_id, a.responsable as nombre,
       case when a.fecha_vencimiento < nexo_hoy() then 'actividad_vencida' else 'vence_hoy' end as tipo,
       format('«%s» (%s) va en %s%% y vence el %s', a.titulo, a.proyecto, a.avance_pct, to_char(a.fecha_vencimiento, 'DD/MM')) as detalle
from ia_actividades a
where a.estatus <> 'Completado' and a.fecha_vencimiento <= nexo_hoy()
union all
select p.usuario_id, p.nombre, 'sin_registro',
       format('Último avance registrado: %s', coalesce(to_char(max(v.fecha), 'DD/MM'), 'nunca'))
from ia_personas p
left join avances v on v.usuario_id = p.usuario_id
where exists (select 1 from actividades a where a.responsable_id = p.usuario_id and a.estatus <> 'Completado')
group by p.usuario_id, p.nombre
having coalesce(max(v.fecha), '2000-01-01') < nexo_hoy() - 3
union all
select b.usuario_id, b.responsable, 'bloqueo_largo',
       format('Bloqueo «%s» en «%s» lleva %s días abierto%s', b.tipo, b.actividad, b.dias_abierto,
              case when b.responsable_externo <> '' then ' (depende de ' || b.responsable_externo || ')' else '' end)
from ia_bloqueos b
where b.abierto and b.dias_abierto >= 3
union all
select k.usuario_id, k.responsable, 'compromiso_vencido',
       format('Se comprometió en «%s» (%s) a: %s. Fecha límite %s', k.sesion, to_char(k.fecha_sesion, 'DD/MM'), k.descripcion, to_char(k.fecha_limite, 'DD/MM'))
from ia_compromisos k
where k.estado = 'Vencido' and k.usuario_id is not null and k.fecha_limite >= nexo_hoy() - 14;

/* ---------- funciones que usa n8n para escribir ---------- */

-- Guarda una sesión analizada. Si el evento ya estaba guardado no hace nada y devuelve su id.
-- p = { evento:{calendar_id,titulo,inicio,fin,doc_id,asistentes}, proyecto, resumen, acuerdos[], cita,
--       participacion:[{nombre,palabras,pct_voz,intervenciones}],
--       personas:[{nombre,actualizacion_completa,menciono_bloqueo,observacion}],
--       compromisos:[{responsable,descripcion,fecha_limite}], compromisos_cumplidos:[id] }
create or replace function nexo_guardar_sesion(p jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  ev  jsonb := p -> 'evento';
  sid int;
  pid int;
  ini timestamptz := (ev ->> 'inicio')::timestamptz;
  fin timestamptz := nullif(ev ->> 'fin', '')::timestamptz;
begin
  if coalesce(ev ->> 'calendar_id', '') = '' then raise exception 'Falta evento.calendar_id'; end if;

  select id into sid from sesiones where calendar_id = ev ->> 'calendar_id';
  if sid is not null then return sid; end if;

  select id into pid from proyectos
  where not archivado and nexo_norm(nombre) = nexo_norm(p ->> 'proyecto')
  order by id limit 1;

  insert into sesiones (calendar_id, titulo, inicio, fin, duracion_min, proyecto_id, transcripcion_id,
                        resumen, acuerdos, cita, asistentes)
  values (ev ->> 'calendar_id', coalesce(nullif(ev ->> 'titulo', ''), 'Sin título'), ini, fin,
          case when fin is not null then round(extract(epoch from fin - ini) / 60)::int end,
          pid, coalesce(ev ->> 'doc_id', ''),
          coalesce(p ->> 'resumen', ''),
          case when jsonb_typeof(p -> 'acuerdos') = 'array' then p -> 'acuerdos' else '[]' end,
          coalesce(p ->> 'cita', ''),
          case when jsonb_typeof(ev -> 'asistentes') = 'array' then ev -> 'asistentes' else '[]' end)
  returning id into sid;

  -- Participación medida por código (palabras) + evaluación de la IA por persona
  insert into participaciones (sesion_id, usuario_id, nombre, palabras, pct_voz, intervenciones,
                               actualizacion_completa, menciono_bloqueo, observacion)
  select sid, nexo_usuario_por_nombre(x ->> 'nombre'), left(x ->> 'nombre', 120),
         coalesce((x ->> 'palabras')::int, 0), coalesce((x ->> 'pct_voz')::numeric, 0), coalesce((x ->> 'intervenciones')::int, 0),
         (ia.e ->> 'actualizacion_completa')::boolean, (ia.e ->> 'menciono_bloqueo')::boolean,
         left(coalesce(ia.e ->> 'observacion', ''), 1000)
  from jsonb_array_elements(case when jsonb_typeof(p -> 'participacion') = 'array' then p -> 'participacion' else '[]' end) x
  left join lateral (
    select e from jsonb_array_elements(case when jsonb_typeof(p -> 'personas') = 'array' then p -> 'personas' else '[]' end) e
    where nexo_norm(e ->> 'nombre') = nexo_norm(x ->> 'nombre') limit 1
  ) ia on true
  where coalesce(x ->> 'nombre', '') <> ''
  on conflict (sesion_id, nombre) do nothing;

  insert into compromisos (sesion_id, usuario_id, responsable, descripcion, fecha_limite)
  select sid, nexo_usuario_por_nombre(k ->> 'responsable'), left(coalesce(k ->> 'responsable', ''), 120),
         left(k ->> 'descripcion', 500),
         case when (k ->> 'fecha_limite') ~ '^\d{4}-\d{2}-\d{2}$' then (k ->> 'fecha_limite')::date end
  from jsonb_array_elements(case when jsonb_typeof(p -> 'compromisos') = 'array' then p -> 'compromisos' else '[]' end) k
  where coalesce(k ->> 'descripcion', '') <> '';

  update compromisos set cumplido = true, cumplido_en_sesion = sid
  where cumplido is not true
    and id in (select (c #>> '{}')::int
               from jsonb_array_elements(case when jsonb_typeof(p -> 'compromisos_cumplidos') = 'array' then p -> 'compromisos_cumplidos' else '[]' end) c
               where (c #>> '{}') ~ '^\d+$');

  return sid;
end $$;

-- Reemplaza las alertas por las de la corrida de hoy (si hoy no hay riesgos, quedan vacías).
-- p = [{usuario_id, nivel, titulo, detalle}]
create or replace function nexo_guardar_alertas(p jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from alertas_ia where true;
  insert into alertas_ia (usuario_id, nivel, titulo, detalle, fecha)
  select (select id from usuarios where id = nullif(a ->> 'usuario_id', '')::int),
         case when a ->> 'nivel' in ('alta', 'media', 'baja') then a ->> 'nivel' else 'media' end,
         left(coalesce(a ->> 'titulo', 'Alerta'), 200), left(coalesce(a ->> 'detalle', ''), 1000), nexo_hoy()
  from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]' end) a;
  get diagnostics n = row_count;
  return n;
end $$;

-- Las funciones que escriben no se pueden llamar por default; db/n8n-acceso.sql da permiso solo a nexo_n8n.
revoke execute on function nexo_guardar_sesion(jsonb) from public;
revoke execute on function nexo_guardar_alertas(jsonb) from public;
