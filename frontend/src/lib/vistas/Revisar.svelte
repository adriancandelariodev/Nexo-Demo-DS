<!-- Actividades completadas pendientes de revisión -->
<script>
  import { app, AE, P, abrirTarjeta } from '$lib/estado.svelte.js';
  import { aprobar, devolver } from '$lib/acciones.js';
  import { toDM } from '$lib/util.js';
  import Enlaces from '$lib/componentes/Enlaces.svelte';

  const lista = $derived(AE().filter((a) => a.estatus === 'Completado' && !a.revisada && (!app.focus || a.responsable_id === app.focus)));
</script>

<section data-view="revisar" class="enter" style="display:grid;gap:20px">
  <div class="page-head">
    <div><p class="label">Jefatura</p><h2>Actividades por revisar</h2></div>
    <p class="muted" style="font-size:.88rem">Cuando un colaborador llega a 100%, la actividad llega aquí. Apruébala o devuélvela para ajustes.</p>
  </div>
  <div class="panel tscroll" id="trev">
    {#if lista.length}
      <table>
        <thead><tr><th>Actividad</th><th>Colaborador</th><th>Inicio → fin</th><th>Descripción</th><th></th></tr></thead>
        <tbody>
          {#each lista as a (a.id)}
            {@const p = P(a.proyecto_id) || {}}
            <tr>
              <td><button type="button" class="linkbtn" data-card={a.id} title="Ver lo que realizó" onclick={() => abrirTarjeta(a.id)}><b>{a.titulo}</b></button><br /><span class="muted" style="font-size:.8rem">{p.cliente} · {p.nombre}</span></td>
              <td>{a.responsable}</td>
              <td class="num">{toDM(a.fecha_inicio)} → {toDM(a.fecha_vencimiento)}</td>
              <td style="max-width:32ch">{a.descripcion || 'Sin descripción'}{#if a.enlaces.length}<div class="links" style="margin-top:4px"><Enlaces enlaces={a.enlaces} /></div>{/if}</td>
              <td>
                <div class="row" style="flex-wrap:nowrap;gap:6px">
                  <button class="btn ghost sm" data-card={a.id} onclick={() => abrirTarjeta(a.id)}>Ver</button>
                  <button class="btn sm" data-ok={a.id} onclick={(e) => aprobar(a, e.currentTarget)}>Aprobar</button>
                  <button class="btn ghost sm danger" data-back={a.id} onclick={() => devolver(a)}>Devolver</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="muted">No hay actividades pendientes de revisión.</p>
    {/if}
  </div>
</section>
