<!-- Administración (solo líder): proyectos, equipo asignado, cuentas y sublíderes -->
<script>
  import { tick } from 'svelte';
  import { app, api, accion, P } from '$lib/estado.svelte.js';
  import { toast } from '$lib/aviso.svelte.js';
  import { toDM, ROL_CORTO } from '$lib/util.js';
  import EditorEnlaces from '$lib/componentes/EditorEnlaces.svelte';

  const S = $derived(app.S);

  /* ---------- proyectos ---------- */
  let pfEl = $state();
  let pfBtn = $state();
  let archBtn = $state();
  let pf = $state(proyectoVacio());
  let pfEnlaces = $state([]);
  let pfEliminar = $state([]);

  function proyectoVacio() {
    return { id: null, cliente: '', nombre: '', resp: '', ini: '', comp: '', miembros: [] };
  }
  const candidatos = $derived(S.usuarios.filter((u) => (u.rol === 'dev' || u.rol === 'sublider') && (u.activo || pf.miembros.includes(u.id))));
  const alternar = (lista, id, si) => (si ? [...new Set([...lista, id])] : lista.filter((x) => x !== id));

  function pfReset() {
    pf = proyectoVacio();
    pfEnlaces = [];
    pfEliminar = [];
  }
  async function pfEditar(id) {
    const p = P(id);
    if (!p) return;
    pf = { id: p.id, cliente: p.cliente, nombre: p.nombre, resp: p.responsable_id || '', ini: p.fecha_inicio || '', comp: p.fecha_compromiso || '', miembros: [...p.miembros] };
    pfEnlaces = p.enlaces.map((l) => ({ ...l }));
    pfEliminar = [];
    await tick();
    pfEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function pfGuardar(e) {
    e.preventDefault();
    const body = {
      accion: 'guardar_proyecto',
      id: pf.id,
      cliente: pf.cliente.trim(),
      nombre: pf.nombre.trim(),
      responsable_id: +pf.resp || null,
      fecha_inicio: pf.ini || null,
      fecha_compromiso: pf.comp || null,
      miembros: pf.miembros,
      enlaces: pfEnlaces.filter((l) => !l.id).map(({ tipo, url }) => ({ tipo, url })),
      enlaces_eliminar: pfEliminar,
    };
    if (!body.cliente || !body.nombre) return toast('Escribe el cliente y el nombre del proyecto.');
    const editando = !!pf.id;
    await accion(async () => { await api('/api/admin', { method: 'POST', body }); pfReset(); },
      editando ? 'Proyecto actualizado.' : 'Proyecto creado. El equipo asignado ya puede registrar actividades.', pfBtn);
  }
  async function pfArchivar() {
    if (!pf.id) return;
    const id = pf.id;
    await accion(async () => { await api('/api/admin', { method: 'POST', body: { accion: 'archivar_proyecto', id, archivado: true } }); pfReset(); },
      'Proyecto archivado. Puedes reactivarlo desde la lista.', archBtn);
  }
  const reactivar = (id, btn) => accion(() => api('/api/admin', { method: 'POST', body: { accion: 'archivar_proyecto', id, archivado: false } }), 'Proyecto reactivado.', btn);

  /* ---------- cuentas ---------- */
  let ufEl = $state();
  let ufBtn = $state();
  let uf = $state(cuentaVacia());

  function cuentaVacia() {
    return { id: null, nombre: '', email: '', rol: 'dev', pass: '', activo: true, equipo: [] };
  }
  const nombreDe = (id) => (S.usuarios.find((x) => x.id === id) || {}).nombre || '—';
  const colaboradores = $derived(S.usuarios.filter((u) => u.rol === 'dev' && (u.activo || uf.equipo.includes(u.id))));

  async function ufEditar(id) {
    const u = S.usuarios.find((x) => x.id === +id);
    if (!u) return;
    uf = { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, pass: '', activo: u.activo, equipo: S.usuarios.filter((x) => x.sublider_id === u.id).map((x) => x.id) };
    await tick();
    ufEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function ufGuardar(e) {
    e.preventDefault();
    const nombre = uf.nombre.trim();
    if (!nombre) return toast('Escribe el nombre.');
    if ((!uf.id || uf.pass) && uf.pass.length < 8) return toast('La contraseña debe tener al menos 8 caracteres.');
    const body = uf.id
      ? { accion: 'actualizar_usuario', id: uf.id, nombre, rol: uf.rol, activo: uf.activo, password: uf.pass, equipo: uf.equipo }
      : { accion: 'crear_usuario', nombre, email: uf.email.trim(), rol: uf.rol, password: uf.pass, equipo: uf.equipo };
    const editando = !!uf.id;
    await accion(async () => { await api('/api/admin', { method: 'POST', body }); uf = cuentaVacia(); },
      editando ? 'Cuenta actualizada.' : 'Cuenta creada. Comparte el correo y la contraseña con la persona.', ufBtn);
  }
</script>

<section data-view="admin" class="enter" style="display:grid;gap:20px">
  <div class="page-head">
    <div><p class="label">Jefatura</p><h2>Administración</h2></div>
    <p class="muted" style="font-size:.88rem">Da de alta proyectos, asigna al equipo y administra las cuentas.</p>
  </div>

  <div class="grid-2">
    <form class="panel form" id="pf" novalidate bind:this={pfEl} onsubmit={pfGuardar}>
      <div class="full panel-head" style="margin:0"><h3 id="pf-title">{pf.id ? 'Editar proyecto' : 'Nuevo proyecto'}</h3><button type="button" class="btn ghost sm" id="pf-new" hidden={!pf.id} onclick={pfReset}>Cancelar edición</button></div>
      <div class="field"><label for="pf-cli">Cliente</label><input type="text" id="pf-cli" list="pf-clis" placeholder="Escribe o elige uno" autocomplete="off" maxlength="120" bind:value={pf.cliente} /><datalist id="pf-clis">{#each S.clientes as c (c.id)}<option value={c.nombre}></option>{/each}</datalist></div>
      <div class="field"><label for="pf-nom">Proyecto</label><input type="text" id="pf-nom" placeholder="Ej. Portal de proveedores" autocomplete="off" maxlength="200" bind:value={pf.nombre} /></div>
      <div class="field"><label for="pf-resp">Responsable</label>
        <select id="pf-resp" bind:value={pf.resp}><option value="">Sin responsable</option>{#each S.usuarios.filter((u) => u.activo) as u (u.id)}<option value={u.id}>{u.nombre}</option>{/each}</select></div>
      <div class="field"><label for="pf-comp">Fecha compromiso</label><input type="date" id="pf-comp" bind:value={pf.comp} /></div>
      <div class="field"><label for="pf-ini">Fecha de inicio</label><input type="date" id="pf-ini" bind:value={pf.ini} /></div>
      <div class="field full"><span class="lbl">Equipo asignado</span>
        <div class="statusgrp" id="pf-mbr">
          {#each candidatos as u (u.id)}<label><input type="checkbox" value={u.id} checked={pf.miembros.includes(u.id)} onchange={(e) => (pf.miembros = alternar(pf.miembros, u.id, e.currentTarget.checked))} />{u.nombre}</label>{:else}<span class="muted" style="font-size:.84rem">Primero crea cuentas de colaboradores.</span>{/each}
        </div>
        <span class="hint">Solo las personas asignadas pueden registrar actividades en el proyecto.</span></div>
      <div class="field full"><span class="lbl">Enlaces del proyecto</span><EditorEnlaces prefijo="pf" bind:items={pfEnlaces} bind:eliminar={pfEliminar} /></div>
      <div class="row full"><button class="btn" type="submit" id="pf-submit" bind:this={pfBtn}>{pf.id ? 'Guardar cambios' : 'Crear proyecto'}</button><button class="btn ghost" type="button" id="pf-arch" hidden={!pf.id} bind:this={archBtn} onclick={pfArchivar}>Archivar proyecto</button></div>
    </form>

    <div class="panel"><div class="panel-head"><h3>Proyectos</h3></div>
      <div class="tscroll" id="adm-proj">
        {#if S.proyectos.length || S.archivados.length}
          <table>
            <thead><tr><th>Proyecto</th><th>Responsable</th><th>Equipo</th><th>Compromiso</th><th></th></tr></thead>
            <tbody>
              {#each S.proyectos as p (p.id)}
                <tr><td><b>{p.cliente}</b><br /><span class="muted" style="font-size:.8rem">{p.nombre}</span></td><td>{p.responsable || '—'}</td><td class="num">{p.miembros.length}</td><td class="num">{toDM(p.fecha_compromiso)}</td><td><button type="button" class="btn ghost sm" data-pe={p.id} onclick={() => pfEditar(p.id)}>Editar</button></td></tr>
              {/each}
              {#each S.archivados as p (p.id)}
                <tr><td><b>{p.cliente}</b><br /><span class="muted" style="font-size:.8rem">{p.nombre} · archivado</span></td><td>—</td><td></td><td></td><td><button type="button" class="btn ghost sm" data-unarch={p.id} onclick={(e) => reactivar(p.id, e.currentTarget)}>Reactivar</button></td></tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="muted">Aún no hay proyectos.</p>
        {/if}
      </div>
    </div>
  </div>

  <div style="display:grid;gap:20px">
    <form class="panel form" id="uf" novalidate bind:this={ufEl} onsubmit={ufGuardar}>
      <div class="full panel-head" style="margin:0"><h3 id="uf-title">{uf.id ? 'Editar cuenta' : 'Nueva cuenta'}</h3><button type="button" class="btn ghost sm" id="uf-new" hidden={!uf.id} onclick={() => (uf = cuentaVacia())}>Cancelar edición</button></div>
      <div class="field"><label for="uf-nom">Nombre</label><input type="text" id="uf-nom" autocomplete="off" maxlength="120" bind:value={uf.nombre} /></div>
      <div class="field"><label for="uf-mail">Correo de la empresa</label><input type="email" id="uf-mail" autocomplete="off" maxlength="200" bind:value={uf.email} disabled={!!uf.id} /></div>
      <div class="field"><label for="uf-rol">Rol</label><select id="uf-rol" bind:value={uf.rol}><option value="dev">Colaborador</option><option value="sublider">Sublíder</option><option value="lider">Líder</option></select></div>
      <div class="field"><label for="uf-pass" id="uf-pass-l">{uf.id ? 'Nueva contraseña' : 'Contraseña inicial'}</label><input type="password" id="uf-pass" autocomplete="new-password" bind:value={uf.pass} /><span class="hint" id="uf-pass-h">{uf.id ? 'Déjala vacía para no cambiarla.' : 'Mínimo 8 caracteres. Compártela por un canal seguro.'}</span></div>
      <div class="field full" id="uf-eqwrap" hidden={uf.rol !== 'sublider'}><span class="lbl">Colaboradores a su cargo</span>
        <div class="statusgrp" id="uf-eq">
          {#each colaboradores as u (u.id)}<label><input type="checkbox" value={u.id} checked={uf.equipo.includes(u.id)} onchange={(e) => (uf.equipo = alternar(uf.equipo, u.id, e.currentTarget.checked))} />{u.nombre}{#if u.sublider_id && u.sublider_id !== uf.id}<span class="muted" style="font-weight:500">&nbsp;· con {nombreDe(u.sublider_id)}</span>{/if}</label>{:else}<span class="muted" style="font-size:.84rem">Aún no hay colaboradores.</span>{/each}
        </div>
        <span class="hint">El sublíder verá el trabajo de estas personas y podrá aprobar, devolver y pedirles actualizaciones. Cada colaborador tiene un solo sublíder.</span></div>
      <label class="row full" id="uf-actwrap" hidden={!uf.id} style="font-size:.86rem;gap:8px"><input type="checkbox" id="uf-act" style="accent-color:var(--accent)" bind:checked={uf.activo} />Cuenta activa</label>
      <div class="row full"><button class="btn" type="submit" id="uf-submit" bind:this={ufBtn}>{uf.id ? 'Guardar cambios' : 'Crear cuenta'}</button></div>
    </form>

    <div class="panel"><div class="panel-head"><h3>Cuentas</h3></div>
      <div class="tscroll" id="adm-usr">
        <table>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Equipo</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {#each S.usuarios as u (u.id)}
              <tr>
                <td><b>{u.nombre}</b></td>
                <td class="mono" style="font-size:.78rem">{u.email}</td>
                <td>{ROL_CORTO[u.rol] || u.rol}</td>
                <td style="font-size:.84rem">
                  {#if u.rol === 'sublider'}{S.usuarios.filter((x) => x.sublider_id === u.id).length} a su cargo
                  {:else if u.rol === 'dev'}{#if u.sublider_id}Con {nombreDe(u.sublider_id)}{:else}<span class="muted">Sin sublíder</span>{/if}{/if}
                </td>
                <td><span class="pill {u.activo ? 's-ok' : 's-todo'}">{u.activo ? 'Activa' : 'Inactiva'}</span></td>
                <td><button type="button" class="btn ghost sm" data-ue={u.id} onclick={() => ufEditar(u.id)}>Editar</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</section>
