<!-- Significado de los colores de las tarjetas -->
<script>
  import { COLS, ST_COLOR } from '$lib/util.js';
  import Iconos from './Iconos.svelte';
</script>

<div class="leyenda">
  {#each COLS as c}<span><i style="background:{ST_COLOR[c]}"></i>{c}</span>{/each}
  <span><i style="background:var(--warn)"></i>Pendiente de revisión</span>
  <span><b class="chip over" style="display:inline-flex;align-items:center;gap:3px;font-size:.7rem"><Iconos nombre="reloj" />fecha</b>Vencida</span>
</div>
