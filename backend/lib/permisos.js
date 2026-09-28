import { q } from './db.js';

// Roles: 'lider' supervisa a todos · 'sublider' supervisa a su equipo y registra lo suyo · 'dev' registra lo suyo.
export const supervisa = (user) => user.rol === 'lider' || user.rol === 'sublider';
export const registra = (user) => user.rol === 'dev' || user.rol === 'sublider';

// Ids de las personas que supervisa el usuario (sin incluirse a sí mismo).
export async function equipoDe(user) {
  if (user.rol === 'lider') {
    return (await q(`select id from usuarios where rol in ('dev', 'sublider') and activo and id <> $1`, [user.id])).map((r) => r.id);
  }
  if (user.rol === 'sublider') {
    return (await q(`select id from usuarios where sublider_id = $1 and activo`, [user.id])).map((r) => r.id);
  }
  return [];
}

// ¿El usuario puede aprobar, devolver o pedir actualizaciones a esta persona?
export async function puedeSupervisarA(user, personaId) {
  if (!supervisa(user) || personaId === user.id) return false;
  if (user.rol === 'lider') {
    const [u] = await q(`select 1 from usuarios where id = $1 and rol in ('dev', 'sublider')`, [personaId]);
    return !!u;
  }
  const [u] = await q(`select 1 from usuarios where id = $1 and sublider_id = $2`, [personaId, user.id]);
  return !!u;
}
