<!-- Sesiones de Google Meet analizadas por n8n: resumen, acuerdos, compromisos y participación -->
<script>
  import { onMount } from 'svelte';
  import { app, api, persona } from '$lib/estado.svelte.js';
  import { initials, toDM, TZ } from '$lib/util.js';

  let D = $state(null);
  let error = $state('');
  let sel = $state(0);

  const esDev = $derived(app.role === 'dev');
  const f = (ts, o) => new Intl.DateTimeFormat('es-MX', { timeZone: TZ, ...o }).format(new Date(ts));
  const hhmm = (ts) => f(ts, { hour: '2-digit', minute: '2-digit', hour12: false });

  // Con "Revisando a" activo, solo las sesiones donde participó esa persona
  const lista = $derived.by(() => {
    if (!D) return [];
    if (!app.focus || esDev) return D.sesiones;
    const ids = new Set(D.participaciones.filter((p) => p.usuario_id === app.focus).map((p) => p.sesion_id));
    return D.sesiones.filter((s) => ids.has(s.id));
  });
  const S = $derived(lista.find((s) => s.id === sel) || lista[0] || null);
  const partDe = (sid) => D.participaciones.filter((p) => p.sesion_id === sid);
  const compDe = (sid) => D.compromisos.filter((c) => c.sesion_id === sid);
  const metricas = $derived(D ? D.metricas.filter((m) => !app.focus || esDev || m.usuario_id === app.focus) : []);

  const hace30 = Date.now() - 30 * 864e5;
  const kpi = $derived.by(() => {
    const ss = lista.filter((s) => new Date(s.inicio).getTime() >= hace30);
    const cs = D ? D.compromisos.filter((c) => ss.some((s) => s.id === c.sesion_id) && (!app.focus || esDev || c.usuario_id === app.focus)) : [];
    const evaluables = cs.filter((c) => c.estado !== 'Pendiente');
    return {
      sesiones: ss.length,
      horas: Math.round(ss.reduce((t, s) => t + (s.duracion_min || 0), 0) / 6) / 10,
      pendientes: cs.filter((c) => c.estado === 'Pendiente').length,
      vencidos: cs.filter((c) => c.estado === 'Vencido').length,
      cumplidos: evaluables.length ? Math.round((cs.filter((c) => c.estado === 'Cumplido').length / evaluables.length) * 100) : null,
    };
  });
  const pill = (e) => ({ Cumplido: 's-ok', Vencido: 's-bloq', Pendiente: 's-rev' })[e] || 's-todo';

  onMount(async () => {
    try {
      D = await api('/api/sesiones');
    } catch (err) {
      error = err.message;
    }
  });
</script>

<section data-view="sesiones" class="enter" style="display:grid;gap:20px">
  <div class="page-head">
    <div>
      <p class="label">Google Calendar + Meet</p>
      <h2>{esDev ? 'Mis sesiones' : app.focus ? `Sesiones de ${persona(app.focus)?.nombre || ''}` : 'Sesiones del equipo'}</h2>
      <p class="muted" style="font-size:.88rem;max-width:62ch;margin-top:4px">
        {esDev
          ? 'Resumen de las reuniones en las que participaste y tus métricas de comunicación. Tu líder ve esta misma información.'
          : 'Cuando termina una reunión con transcripción, la IA la resume y registra acuerdos, compromisos y participación.'}
      </p>
    </div>
  </div>

  {#if error}
    <div class="panel"><p style="color:var(--crit)">{error}</p></div>
  {:else if !D}
    <div class="panel"><p class="muted">Cargando sesiones…</p></div>
  {:else if !lista.length}
    <div class="panel" style="display:grid;gap:6px">
      <h3>Todavía no hay sesiones analizadas</h3>
      <p class="muted" style="font-size:.88rem">Aparecen aquí unos minutos después de que termina una reunión de Google Meet con transcripción activada. n8n revisa el calendario cada 30 minutos.</p>
    </div>
  {:else}
    <div class="kpis">
      <div class="kpi"><span class="label">Sesiones (30 días)</span><b>{kpi.sesiones}</b><span class="d muted">{kpi.horas} h en reuniones</span></div>
      <div class="kpi"><span class="label">Compromisos pendientes</span><b>{kpi.pendientes}</b><span class="d muted">Acordados en reuniones</span></div>
      <div class="kpi"><span class="label">Compromisos vencidos</span><b style={kpi.vencidos ? 'color:var(--crit)' : ''}>{kpi.vencidos}</b><span class="d muted">Sin marcar como cumplidos</span></div>
      <div class="kpi"><span class="label">Cumplidos</span><b style="color:var(--ok)">{kpi.cumplidos == null ? '—' : kpi.cumplidos + '%'}</b><span class="d muted">De los que ya vencieron o se cumplieron</span></div>
    </div>

    <div class="grid-2" style="grid-template-columns:minmax(0,.9fr) minmax(0,1.5fr)">
      <div class="panel">
        <div class="panel-head"><h3>Últimos 45 días</h3></div>
        <ul class="slist">
          {#each lista as s (s.id)}
            <li>
              <button aria-pressed={S?.id === s.id} onclick={() => (sel = s.id)}>
                <span class="sdia">{f(s.inicio, { weekday: 'short' }).replace('.', '')}<b>{f(s.inicio, { day: 'numeric' })}</b></span>
                <span style="min-width:0"><span class="stitulo">{s.titulo}</span><span class="smeta">{f(s.inicio, { month: 'short' })} · {hhmm(s.inicio)} · {s.duracion_min ?? '—'} min{s.proyecto ? ' · ' + s.proyecto : ''}</span></span>
                <span class="pill s-ai">Resumida</span>
              </button>
            </li>
          {/each}
        </ul>
      </div>

      {#if S}
        <div class="panel">
          <div class="panel-head">
            <div>
              <p class="label">{f(S.inicio, { weekday: 'long', day: 'numeric', month: 'long' })} · {hhmm(S.inicio)}</p>
              <h3 style="font-size:1.15rem">{S.titulo}</h3>
              {#if S.proyecto}<span class="muted" style="font-size:.8rem">{S.cliente} · {S.proyecto}</span>{/if}
            </div>
          </div>

          <div class="sec">
            <span class="label">Resumen de la IA</span>
            <p style="font-size:.9rem">{S.resumen || 'Sin resumen.'}</p>
            {#if S.cita}<p class="cita">{S.cita}</p>{/if}
          </div>

          {#if S.acuerdos?.length}
            <div class="sec"><span class="label">Acuerdos</span><ul>{#each S.acuerdos as a}<li>{a}</li>{/each}</ul></div>
          {/if}

          {#if compDe(S.id).length}
            <div class="sec">
              <span class="label">Compromisos</span>
              {#each compDe(S.id) as c (c.id)}
                <div class="comp"><span><b>{c.responsable}</b> · {c.descripcion} <span class="muted mono" style="font-size:.76rem">{c.fecha_limite ? '· ' + toDM(c.fecha_limite) : ''}</span></span><span class="pill {pill(c.estado)}">{c.estado}</span></div>
              {/each}
            </div>
          {/if}

          {#if partDe(S.id).length}
            {@const ps = partDe(S.id)}
            {@const max = Math.max(1, ...ps.map((p) => p.pct_voz))}
            <div class="sec">
              <span class="label">Participación (% de lo que se habló)</span>
              {#each ps as p (p.nombre)}
                <div class="part"><span>{p.nombre}{p.usuario_id ? '' : ' · externo'}</span><div class="bar"><i><span style="width:{(p.pct_voz / max) * 100}%"></span></i><em>{Math.round(p.pct_voz)}%</em></div></div>
              {/each}
            </div>
            {#if ps.some((p) => p.observacion || p.actualizacion_completa != null)}
              <div class="sec">
                <span class="label">Observaciones de comunicación</span>
                <div class="obs">
                  {#each ps.filter((p) => p.usuario_id && (p.observacion || p.actualizacion_completa != null)) as p (p.nombre)}
                    <div class="o">
                      <span class="avatar">{initials(p.nombre)}</span>
                      <div>
                        <b>{p.nombre}</b>
                        {#if p.observacion}<p class="muted">{p.observacion}</p>{/if}
                        <div class="marcas">
                          {#if p.actualizacion_completa === true}<span class="pill s-ok">Actualización completa</span>{/if}
                          {#if p.actualizacion_completa === false}<span class="pill s-rev">Actualización sin dato o siguiente paso</span>{/if}
                          {#if p.menciono_bloqueo}<span class="pill s-bloq">Comunicó bloqueo</span>{/if}
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>

    {#if metricas.length}
      <div class="panel">
        <div class="panel-head"><div><h3>{esDev ? 'Mis métricas de comunicación' : 'Comunicación por persona'}</h3><span class="muted" style="font-size:.8rem">Últimos 30 días · métricas observables de las transcripciones</span></div></div>
        <div class="tscroll">
          <table>
            <thead><tr><th>Persona</th><th style="text-align:right">Sesiones</th><th style="text-align:right">% de voz prom.</th><th style="text-align:right">Actualizaciones completas</th><th style="text-align:right">Bloqueos comunicados</th><th style="text-align:right">Compromisos cumplidos</th></tr></thead>
            <tbody>
              {#each metricas as m (m.usuario_id)}
                <tr>
                  <td style="white-space:nowrap"><b>{m.nombre}</b></td>
                  <td class="num">{m.sesiones}</td>
                  <td class="num">{m.pct_voz_promedio == null ? '—' : m.pct_voz_promedio + '%'}</td>
                  <td class="num">{m.actualizaciones_evaluadas ? `${m.actualizaciones_completas}/${m.actualizaciones_evaluadas}` : '—'}</td>
                  <td class="num">{m.bloqueos_mencionados}</td>
                  <td class="num">{m.compromisos_evaluables ? `${m.compromisos_cumplidos}/${m.compromisos_evaluables}` : '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {/if}
</section>
