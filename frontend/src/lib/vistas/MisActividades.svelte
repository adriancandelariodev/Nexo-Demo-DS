<!-- Tablero personal con "+ Añadir actividad" en cada columna -->
<script>
  import { AM, abrirActividad } from '$lib/estado.svelte.js';
  import Kanban from '$lib/componentes/Kanban.svelte';
  import Leyenda from '$lib/componentes/Leyenda.svelte';
</script>

<section data-view="misact" class="enter" style="display:grid;gap:20px">
  <div class="page-head">
    <div><p class="label">Mi trabajo</p><h2>Mis actividades</h2></div>
    <button class="btn" type="button" data-new="En progreso" onclick={() => abrirActividad('nuevo', null, 'En progreso')}>+ Nueva actividad</button>
  </div>
  <div class="row" style="justify-content:space-between"><Leyenda /><p class="muted" style="font-size:.82rem">Toca una tarjeta para actualizarla.</p></div>
  <div class="tscroll"><Kanban id="mkanban" acts={AM()} agregar conCliente /></div>
</section>
