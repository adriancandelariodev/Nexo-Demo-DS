<!-- Inicio del colaborador (y sección "Mi trabajo" del sublíder) -->
<script>
  import { app, AM, BM, misProyectos, nombreLider, abrirActividad, abrirTarjeta, irA } from '$lib/estado.svelte.js';
  import { marcarLeidos } from '$lib/acciones.js';
  import { stC, toDM, plural, hora } from '$lib/util.js';
  import { contar } from '$lib/efectos.js';
  import Hero from '$lib/componentes/Hero.svelte';

  const acts = $derived(AM());
  const proys = $derived(misProyectos());
  const abiertas = $derived(acts.filter((a) => a.estatus !== 'Completado').length);
  const hechas = $derived(acts.filter((a) => a.estatus === 'Completado'));
  const pend = $derived(hechas.filter((a) => !a.revisada).length);
  const bl = $derived(BM().length);
  const recs = $derived(app.S.recordatorios || []);
</script>

<section data-view="dinicio" class="enter" style="display:grid;gap:20px">
  <Hero />
  <div class="page-head">
    <div><p class="label">Mi trabajo</p><h2>Mis proyectos</h2></div>
    <div class="row"><button class="btn" type="button" data-new="En progreso" onclick={() => abrirActividad('nuevo', null, 'En progreso')}>+ Registrar actividad</button><button class="btn ghost" data-go="misact" onclick={() => irA('misact')}>Ver mis actividades</button></div>
  </div>

  <div id="dh-rec">
    {#if recs.length}
      <div class="notice">
        <div class="row" style="justify-content:space-between"><h3>Mensajes</h3><button type="button" class="btn ghost sm" id="rec-ok" onclick={(e) => marcarLeidos(e.currentTarget)}>Marcar como leídos</button></div>
        <ul class="avisos">
          {#each recs as r (r.id)}
            <li class={r.tipo}>
              <span class="sv"></span>
              <div><p><b>{r.de}</b> · {r.mensaje} <span class="muted" style="font-size:.8rem">{hora(r.creado_en, app.S.hoy)}</span></p>{#if r.nota}<p class="nota">{r.nota}</p>{/if}</div>
              {#if r.actividad_id && app.S.actividades.some((a) => a.id === r.actividad_id)}<button type="button" class="btn sm" data-card={r.actividad_id} onclick={() => abrirTarjeta(r.actividad_id)}>Ver actividad</button>{:else}<span></span>{/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  <div class="kpis" id="dh-kpis">
    <div class="kpi"><span class="label">Actividades abiertas</span><b use:contar={abiertas}></b><span class="d muted">En {proys.length} {plural(proys.length, 'proyecto', 'proyectos')}</span></div>
    <div class="kpi"><span class="label">Completadas</span><b style="color:var(--ok)" use:contar={hechas.length}></b><span class="d muted">{hechas.length - pend} revisadas</span></div>
    <div class="kpi"><span class="label">Pendientes de revisión</span><b style="color:var(--warn)" use:contar={pend}></b><span class="d muted">Esperando a {nombreLider()}</span></div>
    <div class="kpi"><span class="label">Bloqueos abiertos</span><b style={bl ? 'color:var(--crit)' : ''} use:contar={bl}></b><span class="d muted">{bl ? 'Revísalos en Mis bloqueos' : 'Todo en orden'}</span></div>
  </div>

  <div class="grid-2" id="dh-proj" style="grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))">
    {#each proys as p (p.id)}
      {@const my = acts.filter((a) => a.proyecto_id === p.id)}
      {@const d = my.filter((a) => a.estatus === 'Completado').length}
      {@const pc = my.length ? Math.round((d / my.length) * 100) : 0}
      <div class="panel" style="display:grid;gap:12px">
        <div class="panel-head" style="margin:0">
          <div><p class="label">{p.cliente}</p><h3>{p.nombre}</h3><span class="muted" style="font-size:.8rem">Compromiso del proyecto {toDM(p.fecha_compromiso)} · Responsable {p.responsable || '—'}</span></div>
          <span class="pill {stC(p.estatus)}">{p.estatus}</span>
        </div>
        {#if my.length}
          <div class="field" style="gap:4px"><span style="font-size:.82rem;font-weight:600">Mi avance: {d} de {my.length} {plural(my.length, 'actividad completada', 'actividades completadas')}</span><div class="bar"><i><span style="width:{pc}%;background:var(--ok)"></span></i><em>{pc}%</em></div></div>
          <div class="tscroll">
            <table>
              <tbody>
                {#each my as a (a.id)}
                  <tr data-card={a.id} style="cursor:pointer" title="Abrir actividad" onclick={() => abrirTarjeta(a.id)}>
                    <td><b>{a.titulo}</b><br /><span class="muted" style="font-size:.76rem">{toDM(a.fecha_inicio)} → {toDM(a.fecha_vencimiento)}</span></td>
                    <td><div style="display:grid;gap:4px"><span class="pill {stC(a.estatus)}" style="justify-self:start">{a.estatus}</span>{#if a.estatus === 'Completado'}<span class="pill {a.revisada ? 's-ok' : 's-rev'}" style="justify-self:start">{a.revisada ? 'Revisada' : 'Pendiente de revisión'}</span>{/if}</div></td>
                    <td class="num">{a.avance_pct}%</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="muted" style="font-size:.86rem">Aún no registras actividades en este proyecto.</p>
        {/if}
      </div>
    {:else}
      <div class="panel"><p class="muted">Todavía no estás asignado a ningún proyecto. Pide a tu líder que te agregue.</p></div>
    {/each}
  </div>
</section>
