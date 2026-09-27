-- Nexo · esquema de base de datos (PostgreSQL)
-- Se puede ejecutar varias veces: solo crea lo que falta.

create extension if not exists pgcrypto;

create table if not exists usuarios (
  id            serial primary key,
  nombre        text not null,
  email         text not null unique,
  rol           text not null check (rol in ('dev', 'lider')),
  password_hash text not null,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

create table if not exists clientes (
  id     serial primary key,
  nombre text not null unique
);

create table if not exists proyectos (
  id               serial primary key,
  cliente_id       int not null references clientes(id),
  nombre           text not null,
  responsable_id   int references usuarios(id),
  fecha_inicio     date,
  fecha_compromiso date,
  archivado        boolean not null default false,
  creado_en        timestamptz not null default now()
);

-- Quién puede registrar actividades en cada proyecto
create table if not exists proyecto_miembros (
  proyecto_id int not null references proyectos(id) on delete cascade,
  usuario_id  int not null references usuarios(id) on delete cascade,
  primary key (proyecto_id, usuario_id)
);

create table if not exists actividades (
  id                serial primary key,
  proyecto_id       int not null references proyectos(id) on delete cascade,
  responsable_id    int not null references usuarios(id),
  titulo            text not null,
  descripcion       text not null default '',
  siguiente_accion  text not null default '',
  estatus           text not null check (estatus in ('Por hacer', 'En progreso', 'Bloqueado', 'Completado')),
  avance_pct        int not null default 0 check (avance_pct between 0 and 100),
  fecha_inicio      date,
  fecha_vencimiento date,
  revisada          boolean not null default false,
  revisada_en       timestamptz,
  revisada_por      int references usuarios(id),
  creada_en         timestamptz not null default now(),
  actualizada_en    timestamptz not null default now(),
  cerrada_en        timestamptz
);
create unique index if not exists actividades_titulo_unico
  on actividades (proyecto_id, responsable_id, lower(titulo));
create index if not exists actividades_responsable on actividades (responsable_id);

-- Cada guardado del formulario deja un registro (historial y "días con registro")
create table if not exists avances (
  id               serial primary key,
  actividad_id     int not null references actividades(id) on delete cascade,
  usuario_id       int not null references usuarios(id),
  fecha            date not null,
  estatus          text not null,
  avance_pct       int not null,
  descripcion      text not null default '',
  siguiente_accion text not null default '',
  creado_en        timestamptz not null default now()
);
create index if not exists avances_usuario_fecha on avances (usuario_id, fecha);
create index if not exists avances_creado on avances (creado_en desc);

create table if not exists bloqueos (
  id                  serial primary key,
  actividad_id        int not null references actividades(id) on delete cascade,
  avance_id           int references avances(id) on delete set null,
  tipo                text not null,
  descripcion         text not null,
  responsable_externo text not null default '',
  abierto_en          timestamptz not null default now(),
  resuelto_en         timestamptz,
  resuelto_por        int references usuarios(id)
);
create index if not exists bloqueos_abiertos on bloqueos (actividad_id) where resuelto_en is null;

create table if not exists enlaces (
  id           serial primary key,
  tipo         text not null check (tipo in ('drive', 'excel', 'miro', 'otro')),
  url          text not null,
  titulo       text not null default '',
  proyecto_id  int references proyectos(id) on delete cascade,
  actividad_id int references actividades(id) on delete cascade,
  creado_por   int references usuarios(id),
  creado_en    timestamptz not null default now(),
  check (proyecto_id is not null or actividad_id is not null)
);

-- "Pedir actualización" y avisos de actividades devueltas
create table if not exists recordatorios (
  id        serial primary key,
  de_id     int not null references usuarios(id),
  para_id   int not null references usuarios(id),
  mensaje   text not null default '',
  creado_en timestamptz not null default now(),
  leido_en  timestamptz
);
create index if not exists recordatorios_pendientes on recordatorios (para_id) where leido_en is null;
