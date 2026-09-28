<!-- Ventana para pedir una actualización o devolver una actividad con un mensaje -->
<script>
  import { tick, untrack } from 'svelte';
  import { app, api, accion } from '$lib/estado.svelte.js';
  import { toast } from '$lib/aviso.svelte.js';
  import { primer } from '$lib/util.js';
  import Aviso from './Aviso.svelte';

  let dlg = $state();
  let textoEl = $state();
  let okEl = $state();
  let cfg = $state(null);
  let texto = $state('');

  const devolucion = $derived(cfg?.tipo === 'devolucion');
  const actividad = $derived(cfg?.actividad_id && app.S ? app.S.actividades.find((a) => a.id === +cfg.actividad_id) : null);

  $effect(() => {
    const m = app.mensaje;
    if (!dlg) return;
    if (!m) { if (dlg.open) dlg.close(); return; }
    untrack(async () => {
      cfg = m;
      texto = '';
      if (!dlg.open) dlg.showModal();
      await tick();
      textoEl?.focus();
    });
  });

  const cerrar = () => { app.mensaje = null; };

  async function enviar(e) {
    e.preventDefault();
    const c = cfg;
    if (!c) return;
    const t = texto.trim();
    if (!t) { textoEl.focus(); return toast(devolucion ? 'Escribe por qué la devuelves.' : 'Escribe qué necesitas que actualice.'); }
    const dev = devolucion;
    await accion(async () => {
      if (dev) await api('/api/revision', { method: 'POST', body: { actividad_id: +c.actividad_id, accion: 'devolver', motivo: t } });
      else await api('/api/recordatorios', { method: 'POST', body: { usuario_id: +c.usuario_id, actividad_id: c.actividad_id ? +c.actividad_id : null, mensaje: t } });
      app.mensaje = null;
      if (dev) app.ventana = null;
    }, dev ? `Actividad devuelta a ${primer(c.nombre)} con tus comentarios.` : `Se envió la solicitud a ${primer(c.nombre)}.`, okEl, dev);
  }
</script>

<dialog class="dlg dlg-sm" id="msg" aria-labelledby="msg-title" bind:this={dlg} onclose={cerrar} onclick={(e) => { if (e.target === dlg) cerrar(); }}>
  <form id="msg-form" class="dlg-form" novalidate onsubmit={enviar}>
    <div class="dlg-head">
      <h3 id="msg-title">{devolucion ? 'Devolver actividad' : 'Pedir actualización'}</h3>
      <span class="sp"></span>
      <button type="button" class="iconbtn" id="msg-x" aria-label="Cerrar" onclick={cerrar}>×</button>
    </div>
    <div class="dlg-main" style="display:grid;gap:14px">
      <p class="msg-ctx" id="msg-ctx">Para <b>{cfg?.nombre}</b>{actividad ? ` · «${actividad.titulo}»` : ' · todas sus actividades'}</p>
      <div class="field"><label for="msg-text" id="msg-lbl">{devolucion ? '¿Qué debe ajustar?' : '¿Qué necesitas que actualice?'}</label>
        <textarea id="msg-text" maxlength="500" rows="4" bind:this={textoEl} bind:value={texto}
          placeholder={devolucion ? 'Ej. Falta validar los totales contra el reporte del cliente y adjuntar el Excel.' : 'Ej. ¿Ya te dieron el acceso? Actualiza el avance y la fecha estimada.'}></textarea>
        <span class="hint">El colaborador lo verá en su inicio y en el historial de la actividad.</span></div>
    </div>
    <div class="dlg-foot">
      <span class="sp"></span>
      <button class="btn ghost" type="button" id="msg-cancel" onclick={cerrar}>Cancelar</button>
      <button class="btn" class:danger={devolucion} type="submit" id="msg-ok" bind:this={okEl}>{devolucion ? 'Devolver actividad' : 'Enviar solicitud'}</button>
    </div>
  </form>
  {#if app.mensaje}<Aviso />{/if}
</dialog>
