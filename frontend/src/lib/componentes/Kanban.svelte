<!-- Tablero de 4 columnas por estatus -->
<script>
  import { COLS, ST_COLOR } from '$lib/util.js';
  import { abrirActividad, registra } from '$lib/estado.svelte.js';
  import Tarjeta from './Tarjeta.svelte';

  let { acts, id, agregar = false, conCliente = false } = $props();
</script>

<div class="kanban" {id}>
  {#each COLS as c}
    {@const it = acts.filter((a) => a.estatus === c)}
    <div class="col">
      <h3><span class="ct"><i class="coldot" style="background:{ST_COLOR[c]}"></i>{c}</span><span class="mono muted">{it.length}</span></h3>
      {#each it as a (a.id)}<Tarjeta {a} {conCliente} />{:else}<p class="muted" style="font-size:.8rem;padding:4px">Sin actividades</p>{/each}
      {#if agregar}<button type="button" class="col-add" data-new={c} onclick={() => registra() && abrirActividad('nuevo', null, c)}>+ Añadir actividad</button>{/if}
    </div>
  {/each}
</div>
