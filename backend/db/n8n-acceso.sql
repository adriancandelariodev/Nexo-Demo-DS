-- Nexo · usuarios de base de datos para n8n
-- Ejecútalo UNA vez en el SQL Editor de Neon, después de `npm run db:setup`.
-- Antes cambia las dos contraseñas (Neon pide contraseñas largas: usa 20+ caracteres aleatorios).
--
--   nexo_lector → lo usa el Asistente (la IA escribe sus propias consultas SELECT).
--                  Solo puede leer las vistas ia_*, en modo solo lectura y con límite de 10 s.
--   nexo_n8n    → lo usan los flujos automáticos. Lee las vistas ia_* y llama a
--                  nexo_guardar_sesion / nexo_guardar_alertas. No puede tocar ninguna tabla directo.

create role nexo_lector login password 'CAMBIA-ESTA-CONTRASEÑA-lector-2026';
create role nexo_n8n    login password 'CAMBIA-ESTA-CONTRASEÑA-n8n-2026';

grant usage on schema public to nexo_lector, nexo_n8n;

grant select on
  ia_personas, ia_proyectos, ia_actividades, ia_avances, ia_bloqueos,
  ia_sesiones, ia_participaciones, ia_compromisos, ia_rendimiento_semana, ia_riesgos_hoy
to nexo_lector, nexo_n8n;

grant execute on function nexo_guardar_sesion(jsonb), nexo_guardar_alertas(jsonb) to nexo_n8n;

alter role nexo_lector set default_transaction_read_only = on;
alter role nexo_lector set statement_timeout = '10s';
alter role nexo_n8n    set statement_timeout = '30s';

-- Para revisar: conéctate como nexo_lector y esto debe fallar con "permission denied":
--   select * from usuarios;
