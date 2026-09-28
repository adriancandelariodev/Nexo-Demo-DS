<!-- Bloqueos del equipo -->
<script>
  import { app, BE } from '$lib/estado.svelte.js';
  import { plural } from '$lib/util.js';
  import TablaBloqueos from '$lib/componentes/TablaBloqueos.svelte';

  const dias = $derived(app.S.kpis.resolucion_dias);
</script>

<section data-view="bloqueos" class="enter" style="display:grid;gap:20px">
  <div class="page-head">
    <div><p class="label">Seguimiento</p><h2>Bloqueos</h2></div>
    <p class="muted" style="font-size:.88rem" id="res-media">
      {#if dias == null}Sin bloqueos resueltos este mes{:else}Tiempo medio de resolución este mes: <b class="mono">{dias} {plural(dias, 'día', 'días')}</b>{/if}
    </p>
  </div>
  <div class="panel tscroll" id="tblk"><TablaBloqueos list={BE().filter((b) => !app.focus || b.responsable_id === app.focus)} modo="ping" /></div>
</section>
