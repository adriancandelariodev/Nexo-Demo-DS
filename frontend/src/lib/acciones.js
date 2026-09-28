// Acciones que se usan desde varias pantallas
import { app, api, accion, persona, abrirMensaje, nombreLider } from './estado.svelte.js';
import { primer } from './util.js';

export function aprobar(a, btn) {
  return accion(async () => {
    await api('/api/revision', { method: 'POST', body: { actividad_id: a.id, accion: 'aprobar' } });
    app.ventana = null;
  }, `Actividad aprobada. ${primer(a.responsable)} ya lo ve en su inicio.`, btn);
}

export function devolver(a) {
  abrirMensaje({ tipo: 'devolucion', usuario_id: a.responsable_id, actividad_id: a.id, nombre: a.responsable });
}

export function pedirActualizacion(usuarioId, actividadId = null) {
  const u = persona(usuarioId);
  abrirMensaje({ tipo: 'actualizacion', usuario_id: usuarioId, actividad_id: actividadId, nombre: u ? u.nombre : '' });
}

export function resolverBloqueo(id, btn) {
  return accion(() => api('/api/bloqueos', { method: 'POST', body: { id } }), `Bloqueo resuelto. ${nombreLider()} ya lo ve cerrado en su panel.`, btn);
}

export function marcarLeidos(btn) {
  return accion(() => api('/api/recordatorios', { method: 'PUT', body: {} }), '', btn);
}
