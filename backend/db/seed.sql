-- Nexo · datos de ejemplo (los mismos de la demo HTML)
-- Ejecuta primero schema.sql. Las fechas son relativas al día en que lo corres.
-- Contraseña de todas las cuentas: Nexo2026  → cámbialas antes de usarlo en serio.

insert into usuarios (nombre, email, rol, password_hash) values
  ('Jaz',           'jaz@tuempresa.mx',           'lider', crypt('Nexo2026', gen_salt('bf', 10))),
  ('Ana Ríos',      'ana.rios@tuempresa.mx',      'dev',   crypt('Nexo2026', gen_salt('bf', 10))),
  ('Bruno Salas',   'bruno.salas@tuempresa.mx',   'dev',   crypt('Nexo2026', gen_salt('bf', 10))),
  ('Carla Méndez',  'carla.mendez@tuempresa.mx',  'dev',   crypt('Nexo2026', gen_salt('bf', 10))),
  ('Diego Ortiz',   'diego.ortiz@tuempresa.mx',   'dev',   crypt('Nexo2026', gen_salt('bf', 10))),
  ('Elena Paz',     'elena.paz@tuempresa.mx',     'dev',   crypt('Nexo2026', gen_salt('bf', 10))),
  ('Fernando Gil',  'fernando.gil@tuempresa.mx',  'dev',   crypt('Nexo2026', gen_salt('bf', 10))),
  ('Gabriela Luna', 'gabriela.luna@tuempresa.mx', 'dev',   crypt('Nexo2026', gen_salt('bf', 10))),
  ('Héctor Vega',   'hector.vega@tuempresa.mx',   'dev',   crypt('Nexo2026', gen_salt('bf', 10)))
on conflict (email) do nothing;

insert into clientes (nombre) values
  ('DIMANOR'), ('Grupo Altamira'), ('Farmacias del Valle'), ('Transportes Norte'),
  ('Constructora Mirasol'), ('Interno'), ('Textiles Sonora')
on conflict (nombre) do nothing;

insert into proyectos (cliente_id, nombre, responsable_id, fecha_inicio, fecha_compromiso)
select c.id, v.nombre, u.id, current_date + v.ini, current_date + v.fin
from (values
  ('DIMANOR',              'Integración de clientes',    'ana.rios',     -25,  8),
  ('Grupo Altamira',       'Migración de SP a BigQuery', 'bruno.salas',  -28, 21),
  ('Farmacias del Valle',  'Dashboard de ventas',        'carla.mendez', -30,  4),
  ('Transportes Norte',    'API de rutas',               'diego.ortiz',  -25,  7),
  ('Constructora Mirasol', 'Portal de proveedores',      'elena.paz',    -28,  5),
  ('Interno',              'Validación ETL (cuadre)',    'fernando.gil', -23, 14),
  ('Textiles Sonora',      'Carga de catálogos',         'hector.vega',  -17,  0)
) as v(cliente, nombre, usr, ini, fin)
join clientes c on c.nombre = v.cliente
join usuarios u on u.email = v.usr || '@tuempresa.mx'
where not exists (select 1 from proyectos p where p.nombre = v.nombre);

insert into actividades (proyecto_id, responsable_id, titulo, estatus, avance_pct,
                         fecha_inicio, fecha_vencimiento, descripcion, siguiente_accion,
                         revisada, cerrada_en)
select p.id, u.id, v.titulo, v.estatus, v.pct,
       current_date + v.fin - 14, current_date + v.fin, v.descr, v.sig,
       v.estatus = 'Completado' and not v.pendiente,
       case when v.estatus = 'Completado'
            then (current_date + least(v.fin, 0) + time '09:00') at time zone 'America/Mexico_City' end
from (values
  ('Integración de clientes',    'Mapeo de campos cliente',    'Completado',  100, 'ana.rios',      -7, false, '', ''),
  ('Integración de clientes',    'Integración de clientes',    'Bloqueado',    70, 'ana.rios',       8, false,
     'Terminé la integración de clientes. La validación queda pendiente.',
     'Solicitar acceso a producción y reprogramar validación'),
  ('Integración de clientes',    'Validación en producción',   'Por hacer',     0, 'ana.rios',       8, false, '', ''),
  ('Integración de clientes',    'Carga histórica',            'Por hacer',     0, 'gabriela.luna', 13, false, '', ''),
  ('Integración de clientes',    'Documentación técnica',      'En progreso',  40, 'gabriela.luna', 14, false, '', ''),
  ('Integración de clientes',    'Pruebas de conexión',        'Completado',  100, 'ana.rios',      -4, true,
     'Pruebas de conexión contra el ambiente de QA del cliente.', ''),
  ('Integración de clientes',    'Revisión de catálogos',      'En progreso',  90, 'ana.rios',       1, false, '', ''),
  ('Migración de SP a BigQuery', 'SP de ventas',               'Completado',  100, 'bruno.salas',  -10, false, '', ''),
  ('Migración de SP a BigQuery', 'SP de cartera',              'En progreso',  50, 'bruno.salas',    7, false, '', ''),
  ('Migración de SP a BigQuery', 'SP de inventario',           'Por hacer',     0, 'bruno.salas',   14, false, '', ''),
  ('Migración de SP a BigQuery', 'Vistas de consumo',          'En progreso',  30, 'fernando.gil',  17, false, '', ''),
  ('Migración de SP a BigQuery', 'Orquestación',               'Por hacer',     0, 'bruno.salas',   21, false, '', ''),
  ('Dashboard de ventas',        'Modelo de datos',            'Completado',  100, 'carla.mendez', -15, false, '', ''),
  ('Dashboard de ventas',        'Vistas KPIs',                'Completado',  100, 'carla.mendez',  -8, false, '', ''),
  ('Dashboard de ventas',        'Dashboard Tableau',          'Completado',  100, 'carla.mendez',   4, true,
     'Dashboard publicado en Tableau Server con filtros por sucursal.', ''),
  ('Dashboard de ventas',        'Capacitación',               'Por hacer',     0, 'carla.mendez',   5, false, '', ''),
  ('API de rutas',               'Diseño de endpoints',        'Completado',  100, 'diego.ortiz',  -11, false, '', ''),
  ('API de rutas',               'Endpoint de rutas',          'En progreso',  40, 'diego.ortiz',   -2, false, '', ''),
  ('API de rutas',               'Autenticación',              'Por hacer',     0, 'diego.ortiz',    3, false, '', ''),
  ('API de rutas',               'Pruebas de carga',           'Por hacer',     0, 'hector.vega',    7, false, '', ''),
  ('Portal de proveedores',      'Wireframes',                 'Completado',  100, 'elena.paz',    -14, false, '', ''),
  ('Portal de proveedores',      'Carga de proveedores',       'Bloqueado',    10, 'elena.paz',     -1, false, '', ''),
  ('Portal de proveedores',      'Formulario de alta',         'En progreso',  30, 'elena.paz',      5, false, '', ''),
  ('Portal de proveedores',      'Notificaciones',             'Por hacer',     0, 'elena.paz',      5, false, '', ''),
  ('Validación ETL (cuadre)',    'Cuadre de ventas',           'Completado',  100, 'fernando.gil',  -9, false, '', ''),
  ('Validación ETL (cuadre)',    'Cuadre CorteDiarioVendedor', 'Bloqueado',    60, 'fernando.gil',   7, false, '', ''),
  ('Validación ETL (cuadre)',    'Cuadre de contratos',        'En progreso',  50, 'gabriela.luna', 14, false, '', ''),
  ('Carga de catálogos',         'Catálogo de productos',      'Completado',  100, 'hector.vega',   -3, false, '', ''),
  ('Carga de catálogos',         'Catálogo de clientes',       'Completado',  100, 'hector.vega',   -1, true,
     'Catálogo de clientes cargado y validado contra el sistema origen.', '')
) as v(proyecto, titulo, estatus, pct, usr, fin, pendiente, descr, sig)
join proyectos p on p.nombre = v.proyecto
join usuarios u on u.email = v.usr || '@tuempresa.mx'
where not exists (
  select 1 from actividades a
  where a.proyecto_id = p.id and a.responsable_id = u.id and lower(a.titulo) = lower(v.titulo)
);

insert into proyecto_miembros (proyecto_id, usuario_id)
select distinct proyecto_id, responsable_id from actividades
on conflict do nothing;

insert into bloqueos (actividad_id, tipo, descripcion, responsable_externo, abierto_en)
select a.id, v.tipo, v.descr, v.ext, now() - make_interval(days => v.dias)
from (values
  ('Carga de proveedores',       'elena.paz',    'Dependencia del cliente', 'El cliente no ha enviado el layout de proveedores',  'Contacto del cliente', 6),
  ('Cuadre CorteDiarioVendedor', 'fernando.gil', 'Información faltante',    'Diferencias sin explicar en filtros de fecha',       'Equipo SINUBE',        2),
  ('Integración de clientes',    'ana.rios',     'Accesos / permisos',      'Falta acceso al ambiente de producción',             'TI · Infraestructura', 1)
) as v(titulo, usr, tipo, descr, ext, dias)
join usuarios u on u.email = v.usr || '@tuempresa.mx'
join actividades a on a.titulo = v.titulo and a.responsable_id = u.id
where not exists (select 1 from bloqueos b where b.actividad_id = a.id);

-- Historial de avances de las últimas dos semanas (días hábiles)
insert into avances (actividad_id, usuario_id, fecha, estatus, avance_pct, descripcion, siguiente_accion, creado_en)
select a.id, a.responsable_id, g.dia, a.estatus, a.avance_pct,
       'Avance en ' || a.titulo, a.siguiente_accion,
       (g.dia + time '08:30' + (a.responsable_id % 7) * interval '7 minutes') at time zone 'America/Mexico_City'
from (select generate_series(current_date - 13, current_date, interval '1 day')::date as dia) g
cross join lateral (
  select distinct on (x.responsable_id) x.*
  from actividades x
  where x.estatus <> 'Por hacer'
  order by x.responsable_id,
           case x.estatus when 'Bloqueado' then 0 when 'En progreso' then 1 else 2 end,
           x.fecha_vencimiento desc
) a
join usuarios u on u.id = a.responsable_id
where extract(isodow from g.dia) < 6
  and not (u.email like 'diego.ortiz@%' and g.dia > current_date - 4)
  and not (u.email like 'elena.paz@%' and g.dia = current_date - 1)
  and not exists (select 1 from avances);

insert into enlaces (tipo, url, titulo, proyecto_id)
select v.tipo, v.url, v.titulo, p.id
from (values
  ('Integración de clientes',    'drive', 'https://drive.google.com/',  'Carpeta del proyecto'),
  ('Integración de clientes',    'miro',  'https://miro.com/',          'Diagrama de integración'),
  ('Migración de SP a BigQuery', 'drive', 'https://drive.google.com/',  'Carpeta del proyecto'),
  ('Migración de SP a BigQuery', 'excel', 'https://docs.google.com/spreadsheets/', 'Inventario de SP'),
  ('Dashboard de ventas',        'excel', 'https://docs.google.com/spreadsheets/', 'Definición de KPIs'),
  ('API de rutas',               'miro',  'https://miro.com/',          'Diseño de la API'),
  ('Portal de proveedores',      'drive', 'https://drive.google.com/',  'Carpeta del proyecto'),
  ('Portal de proveedores',      'miro',  'https://miro.com/',          'Wireframes'),
  ('Validación ETL (cuadre)',    'excel', 'https://docs.google.com/spreadsheets/', 'Cuadre'),
  ('Carga de catálogos',         'drive', 'https://drive.google.com/',  'Carpeta del proyecto'),
  ('Carga de catálogos',         'excel', 'https://docs.google.com/spreadsheets/', 'Layouts')
) as v(proyecto, tipo, url, titulo)
join proyectos p on p.nombre = v.proyecto
where not exists (select 1 from enlaces e where e.proyecto_id = p.id);

-- Sublíder de ejemplo: Fernando Gil supervisa a Gabriela Luna y Héctor Vega
update usuarios set rol = 'sublider' where email = 'fernando.gil@tuempresa.mx';
update usuarios set sublider_id = (select id from usuarios where email = 'fernando.gil@tuempresa.mx')
 where email in ('gabriela.luna@tuempresa.mx', 'hector.vega@tuempresa.mx');
