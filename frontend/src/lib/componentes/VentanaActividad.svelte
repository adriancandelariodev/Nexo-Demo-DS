<!-- Ventana flotante para registrar, editar o ver (solo lectura) una actividad, con su historial -->
<script>
  import { tick, untrack } from 'svelte';
  import { app, api, cargar, P, supervisa, esMia, nombreLider } from '$lib/estado.svelte.js';
  import { aprobar, devolver } from '$lib/acciones.js';
  import { toast } from '$lib/aviso.svelte.js';
  import { COLS, TIPOS_BLOQUEO, TIPO_LBL, stC, toDM, fechaHora } from '$lib/util.js';
  import EditorEnlaces from './EditorEnlaces.svelte';
  import Avatar from './Avatar.svelte';
  import Aviso from './Aviso.svelte';

  let dlg = $state();
  let tituloEl = $state();
  let bdescEl = $state();
  let modo = $state(null);
  let act = $state(null);
  let f = $state(vacio());
  let enlaces = $state([]);
  let eliminar = $state([]);
  let hist = $state({ texto: '', eventos: [] });
  let guardando = $state(false);
  let token = 0;

  function vacio() {
    return { proyecto: '', titulo: '', desc: '', next: '', pct: 0, st: 'En progreso', ini: '', fin: '', btipo: TIPOS_BLOQUEO[0], bdesc: '', bquien: '' };
  }

  const ver = $derived(modo === 'ver');
  const opciones = $derived.by(() => {
    if (!app.S) return [];
    if (act && modo !== 'nuevo') { const p = P(act.proyecto_id); return p ? [p] : []; }
    return app.S.proyectos.filter((p) => p.soy_miembro);
  });
  const porRevisar = $derived(ver && act && supervisa() && !esMia(act) && act.estatus === 'Completado' && !act.revisada);
  const lugarAviso = $derived(app.mensaje ? 'msg' : app.ventana ? 'dlg' : 'body');
  const proyectoSel = $derived(app.S ? P(f.proyecto) : null);

  // Abre o cierra la ventana cuando cambia app.ventana
  $effect(() => {
    const v = app.ventana;
    if (!dlg) return;
    if (!v) { if (dlg.open) dlg.close(); return; }
    untrack(() => abrir(v));
  });

  async function abrir(v) {
    modo = v.modo;
    const a = v.id ? app.S.actividades.find((x) => x.id === v.id) : null;
    act = a;
    if (a) {
      const bk = app.S.bloqueos.find((b) => b.actividad_id === a.id);
      f = {
        proyecto: a.proyecto_id, titulo: a.titulo, desc: a.descripcion || '', next: a.siguiente_accion || '',
        pct: a.avance_pct, st: a.estatus, ini: a.fecha_inicio || '', fin: a.fecha_vencimiento || '',
        btipo: bk ? bk.tipo : TIPOS_BLOQUEO[0], bdesc: bk ? bk.descripcion : '', bquien: bk ? bk.responsable_externo : '',
      };
      enlaces = a.enlaces.map((l) => ({ ...l }));
    } else {
      const st = COLS.includes(v.estatus) ? v.estatus : 'En progreso';
      f = { ...vacio(), st, pct: st === 'Completado' ? 100 : 0, ini: app.S.hoy, proyecto: app.S.proyectos.find((p) => p.soy_miembro)?.id ?? '' };
      enlaces = [];
    }
    eliminar = [];
    if (!dlg.open) dlg.showModal();
    cargarHistorial(a);
    if (modo === 'nuevo') { await tick(); tituloEl?.focus(); }
  }

  async function cargarHistorial(a) {
    const t = ++token;
    if (!a) { hist = { texto: 'El historial aparece cuando guardes la actividad.', eventos: [] }; return; }
    hist = { texto: 'Cargando historial…', eventos: [] };
    try {
      const d = await api(`/api/actividades?id=${a.id}`);
      if (t !== token) return;
      hist = { texto: d.eventos.length ? '' : 'Sin movimientos.', eventos: d.eventos };
    } catch (err) {
      if (t === token) hist = { texto: err.message, eventos: [] };
    }
  }

  const cerrar = () => { app.ventana = null; };

  function cambioAvance() {
    if (+f.pct === 100) f.st = 'Completado';
    else if (f.st === 'Completado') f.st = 'En progreso';
  }
  function cambioEstatus() {
    if (f.st === 'Completado') f.pct = 100;
    else if (+f.pct === 100) f.pct = 95;
    if (f.st === 'Por hacer') f.pct = 0;
  }

  async function guardar(e) {
    e.preventDefault();
    if (modo !== 'nuevo' && modo !== 'editar') return;
    const p = P(f.proyecto);
    if (!p) return toast('No tienes proyectos asignados.');
    const titulo = f.titulo.trim();
    if (!titulo) { tituloEl.focus(); return toast('Escribe el nombre de la actividad.'); }
    const pct = +f.pct;
    let st = f.st;
    if (pct === 100) st = 'Completado';
    if (st === 'Bloqueado' && !f.bdesc.trim()) { bdescEl?.focus(); return toast(`Describe el bloqueo para que ${nombreLider()} sepa qué lo detiene.`); }
    if (f.ini && f.fin && f.fin < f.ini) return toast('La fecha fin no puede ser anterior a la fecha de inicio.');
    const editando = modo === 'editar';
    const body = {
      proyecto_id: p.id,
      titulo,
      descripcion: f.desc.trim(),
      estatus: st,
      avance_pct: pct,
      siguiente_accion: f.next.trim(),
      fecha_inicio: f.ini || null,
      fecha_vencimiento: f.fin || null,
      bloqueo: st === 'Bloqueado' ? { tipo: f.btipo, descripcion: f.bdesc.trim(), responsable_externo: f.bquien.trim() } : null,
      enlaces: enlaces.filter((l) => !l.id).map(({ tipo, url }) => ({ tipo, url })),
      enlaces_eliminar: eliminar,
    };
    if (editando) body.id = act.id;
    guardando = true;
    try {
      await api('/api/actividades', { method: editando ? 'PUT' : 'POST', body });
    } catch (err) {
      return toast(err.message);
    } finally {
      guardando = false;
    }
    cerrar();
    try { await cargar(); } catch (err) { return toast(err.message); }
    toast(st === 'Completado'
      ? 'Guardada como Completada. Queda pendiente de revisión.'
      : editando ? `Cambios guardados. ${nombreLider()} ya los ve en su panel.` : `Actividad registrada. ${nombreLider()} ya la ve en su panel.`);
  }
</script>

<dialog class="dlg" class:ver id="dlg" aria-label="Actividad" bind:this={dlg} onclose={cerrar} onclick={(e) => { if (e.target === dlg) cerrar(); }}>
  <form id="frm" class="dlg-form" novalidate onsubmit={guardar}>
    <div class="dlg-head">
      <span class="pill {stC(f.st)}" id="dlg-pill">{f.st}</span>
      <span class="muted" id="dlg-ctx" style="font-size:.84rem">{modo === 'nuevo' ? 'Nueva actividad' : act ? `${act.responsable} · ${(P(act.proyecto_id) || {}).cliente || ''}` : ''}</span>
      <span class="sp"></span>
      <button type="button" class="iconbtn" id="dlg-x" aria-label="Cerrar" onclick={cerrar}>×</button>
    </div>
    <div class="dlg-body">
      <div class="dlg-main">
        <input type="text" id="f-act" class="dlg-title" placeholder="Nombre de la actividad" autocomplete="off" maxlength="200" aria-label="Nombre de la actividad" bind:this={tituloEl} bind:value={f.titulo} disabled={ver} />
        <div class="form" style="margin-top:14px">
          <div class="field full"><label for="f-proj">Proyecto</label>
            <select id="f-proj" bind:value={f.proyecto} disabled={ver || modo === 'editar'}>
              {#each opciones as p (p.id)}<option value={p.id}>{p.cliente} · {p.nombre}</option>{/each}
            </select></div>
          <div class="field full"><span class="lbl">Estatus</span>
            <div class="statusgrp" id="f-st">
              {#each COLS as c}<label><input type="radio" name="st" value={c} bind:group={f.st} onchange={cambioEstatus} disabled={ver} />{c}</label>{/each}
            </div></div>
          <div class="field full"><label for="f-pct">Avance: <span class="mono" id="pctv">{f.pct}%</span></label><input type="range" id="f-pct" min="0" max="100" step="5" bind:value={f.pct} oninput={cambioAvance} disabled={ver} /></div>
          <div class="blkbox full" id="blkbox" hidden={f.st !== 'Bloqueado'}>
            <div class="field"><label for="f-btipo">Tipo de bloqueo</label><select id="f-btipo" bind:value={f.btipo} disabled={ver}>{#each TIPOS_BLOQUEO as t}<option>{t}</option>{/each}</select></div>
            <div class="field"><label for="f-bquien">¿Quién lo destraba?</label><input type="text" id="f-bquien" placeholder="Ej. TI · Infraestructura" maxlength="200" bind:value={f.bquien} disabled={ver} /></div>
            <div class="field" style="grid-column:1/-1"><label for="f-bdesc">Descripción del bloqueo</label><input type="text" id="f-bdesc" placeholder="Qué te impide avanzar" maxlength="500" bind:this={bdescEl} bind:value={f.bdesc} disabled={ver} /></div>
          </div>
          <div class="field full"><label for="f-desc">Descripción</label><textarea id="f-desc" placeholder="Añade una descripción más detallada: qué avanzaste en esta actividad" maxlength="4000" bind:value={f.desc} disabled={ver}></textarea></div>
          <div class="field full"><label for="f-next">Siguiente acción</label><input type="text" id="f-next" placeholder="Qué sigue en esta actividad" maxlength="500" bind:value={f.next} disabled={ver} /></div>
          <div class="field"><label for="f-ini">Fecha de inicio</label><input type="date" id="f-ini" bind:value={f.ini} disabled={ver} /></div>
          <div class="field"><label for="f-fin">Fecha fin</label><input type="date" id="f-fin" bind:value={f.fin} disabled={ver} /></div>
          <div class="field full"><span class="lbl">Entregables</span>
            <EditorEnlaces prefijo="f" bind:items={enlaces} bind:eliminar deshabilitado={ver} /></div>
        </div>
      </div>
      <div class="dlg-side">
        <div style="display:grid;gap:8px" id="prev-wrap" hidden={!ver}>
          <h3 id="prev-h">Resumen</h3>
          <div class="preview" id="prev">
            {#if proyectoSel}
              {proyectoSel.cliente.toUpperCase()} · {f.titulo.trim() || '(nombre de la actividad)'} | Avance: {f.pct}% | Estatus: {f.st} | Inicio: {toDM(f.ini)} | Fin: {toDM(f.fin)}
              {#if f.st === 'Bloqueado'}<br /><span style="color:var(--crit)">Bloqueo ({f.btipo}): {f.bdesc || 'sin descripción'}</span>{/if}
              {#if f.next}<br /><span class="muted">Siguiente: {f.next}</span>{/if}
              {#if enlaces.length}<br /><span class="muted">Entregables: {enlaces.map((l) => TIPO_LBL[l.tipo] || l.tipo).join(', ')}</span>{/if}
            {:else}No tienes proyectos asignados. Pide a tu líder que te asigne a uno.{/if}
          </div>
        </div>
        <div style="display:grid;gap:10px"><h3>Actividad</h3>
          <ul class="hist" id="hist">
            {#if hist.texto}<li class="muted" style="display:block">{hist.texto}</li>{/if}
            {#each hist.eventos as e, i (i)}
              <li class={e.tipo || ''}><Avatar id={e.usuario_id} nombre={e.quien} /><div><p><b>{e.quien}</b> {e.texto}</p>{#if e.detalle}<p class="hist-d">{e.detalle}</p>{/if}<span class="hist-t">{fechaHora(e.fecha)}</span></div></li>
            {/each}
          </ul>
        </div>
      </div>
    </div>
    <div class="dlg-foot">
      <span class="hint" id="st-hint">{ver ? 'Solo lectura: cada colaborador actualiza sus actividades.' : `Al llegar a 100% pasa a Completado y queda pendiente de revisión de ${nombreLider()}.`}</span>
      <span class="sp"></span>
      <button class="btn ghost" type="button" id="f-cancel" onclick={cerrar}>{ver ? 'Cerrar' : 'Cancelar'}</button>
      <button class="btn ghost danger" type="button" id="f-devolver" hidden={!porRevisar} data-back={porRevisar ? act.id : undefined} onclick={() => devolver(act)}>Devolver</button>
      <button class="btn ok" type="button" id="f-aprobar" hidden={!porRevisar} data-ok={porRevisar ? act.id : undefined} onclick={(e) => aprobar(act, e.currentTarget)}>Aprobar</button>
      <button class="btn" type="submit" id="f-submit" disabled={guardando}>{modo === 'nuevo' ? 'Guardar actividad' : 'Guardar cambios'}</button>
    </div>
  </form>
  {#if lugarAviso === 'dlg'}<Aviso />{/if}
</dialog>
