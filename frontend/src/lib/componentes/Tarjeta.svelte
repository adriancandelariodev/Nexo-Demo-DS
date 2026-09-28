<!-- Tarjeta de actividad estilo tablero: color por estatus, fecha, entregables e iniciales -->
<script>
  import { P, vencida, abrirTarjeta } from '$lib/estado.svelte.js';
  import { ST_COLOR, fechaCorta } from '$lib/util.js';
  import Iconos from './Iconos.svelte';
  import Avatar from './Avatar.svelte';

  let { a, conCliente = false } = $props();
  const pendiente = $derived(a.estatus === 'Completado' && !a.revisada);
  const venc = $derived(vencida(a));
</script>

<button type="button" class="tcard" data-card={a.id} onclick={() => abrirTarjeta(a.id)}>
  <span class="tlabels"><i style="background:{ST_COLOR[a.estatus]}" title={a.estatus}></i>{#if pendiente}<i style="background:var(--warn)" title="Pendiente de revisión"></i>{/if}</span>
  {#if conCliente}<span class="tcli">{(P(a.proyecto_id) || {}).cliente}</span>{/if}
  <span class="ttitle">{#if a.estatus === 'Completado' && a.revisada}<span class="chk" title="Revisada"><Iconos nombre="check" /></span>{/if}<span>{a.titulo}</span></span>
  <span class="tfoot">
    {#if a.fecha_vencimiento}<span class="chip {venc ? 'over' : a.estatus === 'Completado' ? 'done' : ''}" title={venc ? 'Vencida' : 'Fecha fin'}><Iconos nombre="reloj" />{fechaCorta(a.fecha_vencimiento)}</span>{/if}
    {#if a.avance_pct > 0 && a.avance_pct < 100}<span title="Avance">{a.avance_pct}%</span>{/if}
    {#if a.descripcion}<span title="Tiene descripción"><Iconos nombre="desc" /></span>{/if}
    {#if a.enlaces.length}<span title="Entregables"><Iconos nombre="clip" />{a.enlaces.length}</span>{/if}
    <Avatar id={a.responsable_id} nombre={a.responsable} />
  </span>
</button>
