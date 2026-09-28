<!-- Vista de una persona del equipo (o selector si no hay nadie elegido) -->
<script>
  import { app, AE, BE, persona, setFocus, irA } from '$lib/estado.svelte.js';
  import { pedirActualizacion } from '$lib/acciones.js';
  import { stC, toDM, plural, initials, resumen, hora } from '$lib/util.js';
  import { contar } from '$lib/efectos.js';

  const S = $derived(app.S);
  const U = $derived(app.focus ? persona(app.focus) : null);
  const acts = $derived(U ? AE().filter((a) => a.responsable_id === U.id) : []);
  const ps = $derived(S.proyectos.filter((p) => acts.some((a) => a.proyecto_id === p.id)));
  const bl = $derived(U ? BE().filter((b) => b.responsable_id === U.id) : []);
  const abiertas = $derived(acts.filter((a) => a.estatus !== 'Completado').length);
  const feed = $derived(U ? S.feed.filter((f) => f.usuario_id === U.id).slice(0, 8) : []);
  const hab = $derived(S.semana.habiles);
</script>

<section data-view="persona" class="enter" style="display:grid;gap:20px" id="v-persona">
  {#if !U}
    <div class="page-head"><div><p class="label">Equipo</p><h2>¿A quién quieres revisar?</h2></div></div>
    {#if S.personas.length}
      <div class="pgrid">
        {#each S.personas as p (p.id)}
          <button class="pcard" data-pick={p.id} onclick={() => { setFocus(p.id); irA('persona'); }}>
            <span class="avatar" style="grid-row:auto">{initials(p.nombre)}</span><b>{p.nombre}</b>
            <span class="muted" style="font-size:.8rem">{p.dias}/{hab} días · {p.cerradas} cerradas{#if p.bloqueos} · <span style="color:var(--crit)">{p.bloqueos} {plural(p.bloqueos, 'bloqueo', 'bloqueos')}</span>{/if}</span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="muted">Aún no hay colaboradores.</p>
    {/if}
  {:else}
    <div class="page-head">
      <div class="phead"><span class="bigav">{initials(U.nombre)}</span><div><p class="label">Colaborador</p><h2>{U.nombre}</h2><p class="muted mono" style="font-size:.8rem">{U.email}</p></div></div>
      <button class="btn ghost" data-ping={U.id} onclick={() => pedirActualizacion(U.id)}>Pedir actualización</button>
    </div>
    <div class="kpis">
      <div class="kpi"><span class="label">Días con registro</span><b style={U.dias < hab ? 'color:var(--crit)' : ''}>{U.dias}/{hab}</b><span class="d muted">Semana {S.semana.num}</span></div>
      <div class="kpi"><span class="label">Actividades cerradas</span><b use:contar={U.cerradas}></b><span class="d muted">Esta semana</span></div>
      <div class="kpi"><span class="label">Actividades abiertas</span><b use:contar={abiertas}></b><span class="d muted">En {ps.length} {plural(ps.length, 'proyecto', 'proyectos')}</span></div>
      <div class="kpi"><span class="label">Bloqueos abiertos</span><b style={bl.length ? 'color:var(--crit)' : ''} use:contar={bl.length}></b><span class="d muted">{bl.length ? 'Más antiguo: ' + Math.max(...bl.map((b) => b.dias)) + ' días' : 'Sin bloqueos'}</span></div>
    </div>
    <div class="grid-2">
      <div style="display:grid;gap:16px">
        {#each ps as p (p.id)}
          <div class="panel">
            <div class="panel-head"><div><h3>{p.cliente} · {p.nombre}</h3><span class="muted" style="font-size:.8rem">Compromiso {toDM(p.fecha_compromiso)} · Avance del proyecto {p.pct}%</span></div><span class="pill {stC(p.estatus)}">{p.estatus}</span></div>
            <div class="tscroll">
              <table>
                <thead><tr><th>Actividad</th><th>Estatus</th><th>Avance</th><th>Compromiso</th></tr></thead>
                <tbody>
                  {#each acts.filter((a) => a.proyecto_id === p.id) as a (a.id)}
                    <tr>
                      <td><b>{a.titulo}</b></td>
                      <td><div style="display:grid;gap:4px"><span class="pill {stC(a.estatus)}" style="justify-self:start">{a.estatus}</span>{#if a.estatus === 'Completado'}<span class="pill {a.revisada ? 's-ok' : 's-rev'}" style="justify-self:start">{a.revisada ? 'Revisada' : 'Pendiente de revisión'}</span>{/if}</div></td>
                      <td><div class="bar"><i><span style="width:{a.avance_pct}%"></span></i><em>{a.avance_pct}%</em></div></td>
                      <td class="num">{toDM(a.fecha_vencimiento)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {:else}
          <div class="panel"><p class="muted">Sin actividades registradas.</p></div>
        {/each}
      </div>
      <div style="display:grid;gap:16px">
        <div class="panel">
          <div class="panel-head"><h3>Bloqueos</h3></div>
          {#each bl as b (b.id)}
            <div style="display:grid;gap:4px;padding:8px 0;border-top:1px solid var(--line)"><span class="pill s-bloq" style="justify-self:start">{b.tipo}</span><b style="font-size:.9rem">{b.actividad}</b><span class="muted" style="font-size:.82rem">{b.descripcion} · {b.dias} días abierto</span></div>
          {:else}
            <p class="muted">Sin bloqueos abiertos.</p>
          {/each}
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Últimos avances</h3></div>
          {#if feed.length}
            <ul class="feed">{#each feed as f (f.id)}<li><span class="avatar">{initials(f.usuario)}</span><span class="sumline">{resumen(f)}</span><span class="meta">{hora(f.creado_en, S.hoy)}</span></li>{/each}</ul>
          {:else}
            <p class="muted">Sin avances recientes.</p>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</section>
