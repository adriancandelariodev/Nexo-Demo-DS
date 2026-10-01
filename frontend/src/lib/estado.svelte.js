// Estado central de la app: sesión, datos del backend, vista actual y ventanas abiertas.
import { toast } from './aviso.svelte.js';
import { horaHMS, sinDuplicados } from './util.js';

export const HOME = { lider: 'inicio', sublider: 'inicio', dev: 'dinicio' };
const VISTAS_EQUIPO = ['inicio', 'proyectos', 'revisar', 'bloqueos', 'persona'];
const VISTAS_MIAS = ['dinicio', 'misact', 'misblk'];
export const ALLOWED = { lider: [...VISTAS_EQUIPO, 'admin', 'asistente', 'sesiones'], sublider: [...VISTAS_EQUIPO, ...VISTAS_MIAS, 'sesiones'], dev: [...VISTAS_MIAS, 'sesiones'] };

export const app = $state({
  S: null,            // lo que devuelve /api/estado
  role: null,
  me: null,
  verificando: true,  // revisando si ya hay sesión al abrir la página
  vista: '',
  focus: 0,           // persona "en revisión" (líder / sublíder)
  cliente: '',        // filtro de cliente del panel
  kbProyecto: 0,      // proyecto elegido en el tablero
  ventana: null,      // ventana de actividad: { modo: 'nuevo'|'editar'|'ver', id, estatus }
  mensaje: null,      // ventana de mensaje: { tipo: 'actualizacion'|'devolucion', usuario_id, actividad_id, nombre }
  sync: false,        // actualizando en segundo plano
  actualizado: '',    // hora de la última actualización
});

/* ---------- API ---------- */
export async function api(url, opt = {}) {
  let r;
  try {
    r = await fetch(url, {
      method: opt.method || 'GET',
      headers: opt.body ? { 'Content-Type': 'application/json' } : {},
      body: opt.body ? JSON.stringify(opt.body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new Error('No hay conexión con el servidor.');
  }
  let d = {};
  try { d = await r.json(); } catch { /* respuesta vacía */ }
  if (r.status === 401 && !opt.sinRedireccion && app.role) mostrarLogin();
  if (!r.ok) throw new Error(d.error || 'Ocurrió un error. Inténtalo de nuevo.');
  return d;
}

export async function cargar() {
  app.S = await api('/api/estado');
  app.actualizado = horaHMS();
  if (app.focus && !persona(app.focus)) app.focus = 0;
}

// Ejecuta una acción contra la API, recarga el estado y avisa. `btn` se desactiva mientras tanto.
export async function accion(fn, msg, btn, recargar = true) {
  if (btn) btn.disabled = true;
  try {
    await fn();
    if (recargar) await cargar();
    if (msg) toast(msg);
  } catch (err) {
    toast(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Actualización automática (la programa la página principal)
let refrescando = false;
export async function refrescar() {
  if (!app.role || !app.S || refrescando || document.hidden) return;
  refrescando = true;
  app.sync = true;
  try {
    await cargar();
  } catch {
    /* se reintenta en el siguiente ciclo */
  } finally {
    refrescando = false;
    app.sync = false;
  }
}

/* ---------- sesión y navegación ---------- */
export async function entrar(u) {
  app.role = u.rol;
  app.me = u;
  app.focus = 0;
  app.cliente = '';
  app.kbProyecto = 0;
  await cargar();
  const h = (location.hash || '').slice(1);
  irA(ALLOWED[app.role].includes(h) ? h : HOME[app.role]);
  app.verificando = false;
}

export function mostrarLogin() {
  app.ventana = null;
  app.mensaje = null;
  app.role = null;
  app.me = null;
  app.S = null;
  app.vista = '';
  app.verificando = false;
}

export function irA(v) {
  if (!app.role || !app.S) return;
  if (!ALLOWED[app.role].includes(v)) v = HOME[app.role];
  app.vista = v;
  try { history.replaceState(null, '', '#' + v); } catch { /* sin historial */ }
  window.scrollTo(0, 0);
}

export const setFocus = (id) => { app.focus = +id || 0; };

/* ---------- consultas sobre el estado ---------- */
// Alcance según rol: "equipo" = lo que supervisa (líder: todo; sublíder: su equipo) · "mío" = lo que registra
export const supervisa = () => app.role === 'lider' || app.role === 'sublider';
export const registra = () => app.role === 'dev' || app.role === 'sublider';
export const esMia = (x) => !!app.me && x.responsable_id === app.me.id;
export const P = (id) => app.S.proyectos.find((p) => p.id === +id);
export const AE = () => (app.role === 'lider' ? app.S.actividades : app.S.actividades.filter((a) => !esMia(a)));
export const BE = () => (app.role === 'lider' ? app.S.bloqueos : app.S.bloqueos.filter((b) => !esMia(b)));
export const FE = () => (app.role === 'lider' ? app.S.feed : app.S.feed.filter((f) => f.usuario_id !== app.me.id));
export const AM = () => app.S.actividades.filter(esMia);
export const BM = () => app.S.bloqueos.filter(esMia);
export const misProyectos = () => app.S.proyectos.filter((p) => p.soy_miembro || AM().some((a) => a.proyecto_id === p.id));
export const actsDe = (pid) => AE().filter((a) => a.proyecto_id === pid);
export const vencida = (a) => a.estatus !== 'Completado' && a.fecha_vencimiento && a.fecha_vencimiento < app.S.hoy;
export const persona = (id) => (app.S?.personas || []).find((p) => p.id === +id);
export const nombreLider = () => app.S?.lider || 'tu líder';
export const projsFor = () =>
  app.S.proyectos.filter((p) => (app.role === 'lider' || p.del_equipo) && (!app.focus || AE().some((a) => a.proyecto_id === p.id && a.responsable_id === app.focus)));
export const clientesDe = (uid) =>
  [...new Set(app.S.proyectos.filter((x) => x.miembros.includes(uid) || AE().some((a) => a.proyecto_id === x.id && a.responsable_id === uid)).map((x) => x.cliente))];
export const projLinks = (p) => sinDuplicados([...p.enlaces, ...actsDe(p.id).flatMap((a) => a.enlaces)]);

/* ---------- ventanas ---------- */
export function abrirActividad(modo, a, estatus) {
  if (modo === 'nuevo' && !app.S.proyectos.some((p) => p.soy_miembro)) {
    return toast('Todavía no estás asignado a ningún proyecto. Pide a tu líder que te agregue.');
  }
  app.ventana = { modo, id: a ? a.id : null, estatus: estatus || null, n: Date.now() };
}
// Abre una tarjeta: propia → edición; de alguien del equipo → solo lectura
export function abrirTarjeta(id) {
  const a = app.S?.actividades.find((x) => x.id === +id);
  if (a) abrirActividad(esMia(a) ? 'editar' : 'ver', a);
}
export function abrirMensaje(cfg) {
  app.mensaje = { ...cfg, n: Date.now() };
}
