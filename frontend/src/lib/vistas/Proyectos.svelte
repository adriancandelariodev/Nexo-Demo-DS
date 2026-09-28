<!-- Tablero de un proyecto (solo lectura para líder y sublíder) -->
<script>
  import { app, P, projsFor, actsDe, projLinks } from '$lib/estado.svelte.js';
  import { stC, toDM } from '$lib/util.js';
  import Kanban from '$lib/componentes/Kanban.svelte';
  import Leyenda from '$lib/componentes/Leyenda.svelte';
  import Enlaces from '$lib/componentes/Enlaces.svelte';

  const ps = $derived(projsFor());
  const sel = $derived(ps.some((p) => p.id === app.kbProyecto) ? app.kbProyecto : ps[0]?.id);
  const p = $derived(sel ? P(sel) : null);
</script>

<section data-view="proyectos" class="enter" style="display:grid;gap:20px">
  <div class="page-head">
    <div><p class="label">Tablero</p><h2 id="kb-title">{p ? `${p.cliente} · ${p.nombre}` : 'Sin proyectos'}</h2></div>
    <div class="row">
      <select id="kb-proj" aria-label="Proyecto" style="width:auto" value={sel} onchange={(e) => (app.kbProyecto = +e.currentTarget.value)}>
        {#each ps as x (x.id)}<option value={x.id}>{x.cliente} · {x.nombre}</option>{/each}
      </select>
    </div>
  </div>
  <div class="row" id="kb-meta">
    {#if p}
      <span class="pill {stC(p.estatus)}">{p.estatus}</span><span class="muted" style="font-size:.86rem">Avance {p.pct}% · Compromiso {toDM(p.fecha_compromiso)} · Responsable {p.responsable || '—'}</span><div class="links"><Enlaces enlaces={projLinks(p)} /></div>
    {/if}
  </div>
  <div class="row" style="justify-content:space-between"><Leyenda /><p class="muted" style="font-size:.82rem">Toca una tarjeta para ver su detalle e historial.</p></div>
  <div class="tscroll">
    {#if p}
      <Kanban id="kanban" acts={actsDe(p.id).filter((a) => !app.focus || a.responsable_id === app.focus)} />
    {:else}
      <div class="kanban" id="kanban"></div>
    {/if}
  </div>
</section>
