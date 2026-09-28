<!-- Tabla de bloqueos: modo "resolver" (los míos) o "ping" (los de mi equipo) -->
<script>
  import { resolverBloqueo, pedirActualizacion } from '$lib/acciones.js';
  let { list, modo } = $props();
  const mios = $derived(modo === 'resolver');
</script>

{#if !list.length}
  <p class="muted">Sin bloqueos abiertos.</p>
{:else}
  <table>
    <thead><tr><th>Proyecto / actividad</th><th>Tipo</th><th>Descripción</th><th>Lo destraba</th>{#if !mios}<th>Responsable</th>{/if}<th>Días abierto</th><th></th></tr></thead>
    <tbody>
      {#each list as b (b.id)}
        <tr>
          <td><b>{b.cliente}</b><br /><span class="muted" style="font-size:.8rem">{b.actividad}</span></td>
          <td><span class="pill s-bloq">{b.tipo}</span></td>
          <td>{b.descripcion}</td>
          <td>{b.responsable_externo || '—'}</td>
          {#if !mios}<td>{b.responsable}</td>{/if}
          <td class="num" style={b.dias >= 5 ? 'color:var(--crit);font-weight:600' : ''}>{b.dias}</td>
          <td>
            {#if mios}
              <button class="btn sm" data-r={b.id} onclick={(e) => resolverBloqueo(b.id, e.currentTarget)}>Marcar resuelto</button>
            {:else}
              <button class="btn ghost sm" data-ping={b.responsable_id} data-act={b.actividad_id} onclick={() => pedirActualizacion(b.responsable_id, b.actividad_id)}>Pedir actualización</button>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
