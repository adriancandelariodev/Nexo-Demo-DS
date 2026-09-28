<!-- Panel general (líder y sublíder): KPIs, avance por proyecto, pendientes, alertas, feed y resumen semanal -->
<script>
  import { app, AE, BE, FE, P, projsFor, projLinks, vencida, clientesDe, irA, abrirTarjeta } from '$lib/estado.svelte.js';
  import { aprobar } from '$lib/acciones.js';
  import { stC, toDM, barColor, rangoFechas, plural, initials, resumen, hora } from '$lib/util.js';
  import { contar } from '$lib/efectos.js';
  import Hero from '$lib/componentes/Hero.svelte';
  import Enlaces from '$lib/componentes/Enlaces.svelte';

  const S = $derived(app.S);
  const hab = $derived(S.semana.habiles);
  const clientes = $derived([...new Set(projsFor().map((p) => p.cliente))].sort((a, b) => a.localeCompare(b, 'es')));
  const filtroCli = $derived(clientes.includes(app.cliente) ? app.cliente : '');
  const filas = $derived(projsFor().filter((p) => !filtroCli || p.cliente === filtroCli));
  const k = $derived(S.kpis);
  const dif = $derived(k.cerradas - k.cerradas_prev);
  const bloq = $derived(BE());
  const venc = $derived(AE().filter(vencida));
  const pendientes = $derived(AE().filter((a) => a.estatus === 'Completado' && !a.revisada && (!app.focus || a.responsable_id === app.focus)));
  const feed = $derived(FE().filter((x) => !app.focus || x.usuario_id === app.focus).slice(0, 8));
  const personas = $derived(S.personas.filter((p) => !app.focus || p.id === app.focus));

  function verTablero(id) {
    app.kbProyecto = id;
    irA('proyectos');
  }
</script>

<section data-view="inicio" class="enter" style="display:grid;gap:20px">
  <Hero />
  <div class="page-head">
    <div><p class="label" id="wk-lbl">Semana {S.semana.num} · {rangoFechas(S.semana.ini, S.semana.fin)}</p><h2>Panel general</h2></div>
    <div class="row">
      <select aria-label="Filtrar por cliente" id="fcli" style="width:auto" value={filtroCli} onchange={(e) => (app.cliente = e.currentTarget.value)}>
        <option value="">Todos los clientes</option>
        {#each clientes as c}<option>{c}</option>{/each}
      </select>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><span class="label">Avances registrados</span><b id="k-av" use:contar={k.avances}></b><span class="d muted" id="k-av-d">de {k.esperados} esperados ({S.personas.length} × {hab} {plural(hab, 'día', 'días')})</span></div>
    <div class="kpi"><span class="label">Actividades cerradas</span><b id="k-ce" use:contar={k.cerradas}></b><span class="d muted" id="k-ce-d" style={dif > 0 ? 'color:var(--ok)' : dif < 0 ? 'color:var(--crit)' : ''}>{dif >= 0 ? '+' : ''}{dif} vs semana {k.semana_prev}</span></div>
    <div class="kpi"><span class="label">Bloqueos abiertos</span><b style="color:var(--crit)" id="k-bl" use:contar={bloq.length}></b><span class="d muted" id="k-bl-d">{bloq.length ? `Más antiguo: ${Math.max(...bloq.map((b) => b.dias))} días` : 'Sin bloqueos'}</span></div>
    <div class="kpi"><span class="label">Actividades vencidas</span><b style="color:var(--warn)" id="k-ve" use:contar={venc.length}></b><span class="d muted" id="k-ve-d">{venc.length ? [...new Set(venc.map((a) => (P(a.proyecto_id) || {}).cliente))].join(', ') : 'Todo al día'}</span></div>
  </div>

  <div class="grid-2">
    <div class="panel">
      <div class="panel-head"><h3>Avance por proyecto</h3><span class="muted" style="font-size:.8rem">% = actividades cerradas ÷ totales</span></div>
      <div class="tscroll" id="tproj">
        {#if filas.length}
          <table>
            <thead><tr><th>Proyecto</th><th>Responsable</th><th>Avance</th><th>Estatus</th><th>Compromiso</th><th>Enlaces</th></tr></thead>
            <tbody>
              {#each filas as p (p.id)}
                <tr>
                  <td><button type="button" class="linkbtn" data-kb={p.id} onclick={() => verTablero(p.id)}><b>{p.cliente}</b></button><br /><span class="muted" style="font-size:.8rem">{p.nombre}</span></td>
                  <td>{p.responsable || '—'}</td>
                  <td><div class="bar"><i><span style="width:{p.pct}%;background:{barColor(p.estatus)}"></span></i><em>{p.pct}%</em></div></td>
                  <td><span class="pill {stC(p.estatus)}">{p.estatus}</span></td>
                  <td class="num">{toDM(p.fecha_compromiso)}</td>
                  <td><div class="links"><Enlaces enlaces={projLinks(p)} /></div></td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="muted">Sin proyectos. Crea uno desde Administración.</p>
        {/if}
      </div>
    </div>

    <div style="display:grid;gap:20px">
      <div class="panel">
        <div class="panel-head"><h3>Completadas por revisar</h3><button class="btn ghost sm" data-go="revisar" onclick={() => irA('revisar')}>Ver todas</button></div>
        <ul class="att" id="irev">
          {#each pendientes.slice(0, 4) as a (a.id)}
            <li><span class="sv" style="background:var(--ok)"></span><div><button type="button" class="linkbtn" data-card={a.id} onclick={() => abrirTarjeta(a.id)}><b>{a.titulo}</b></button><p>{a.responsable} · {(P(a.proyecto_id) || {}).cliente}</p></div><button class="btn sm" data-ok={a.id} onclick={(e) => aprobar(a, e.currentTarget)}>Aprobar</button></li>
          {:else}
            <li style="grid-template-columns:1fr"><p>Sin pendientes.</p></li>
          {/each}
        </ul>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Requieren atención</h3><span class="muted" style="font-size:.8rem">Reglas automáticas</span></div>
        <ul class="att" id="alerts">
          {#each S.alertas as a}
            <li><span class="sv {a.sev === 'Crítico' ? 'c' : ''}"></span><div><b>{a.titulo}</b><p>{a.detalle}</p></div><span class="pill {a.sev === 'Crítico' ? 's-bloq' : 's-rev'}">{a.sev}</span></li>
          {:else}
            <li style="grid-template-columns:1fr"><p>Sin alertas. Todo en orden.</p></li>
          {/each}
        </ul>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Últimos avances</h3></div>
        <ul class="feed" id="feed">
          {#each feed as f (f.id)}
            <li><span class="avatar">{initials(f.usuario)}</span><span class="sumline">{resumen(f)}</span><span class="meta"><b style="color:var(--ink)">{f.usuario}</b> · {hora(f.creado_en, S.hoy)}</span></li>
          {:else}
            <li style="grid-template-columns:1fr"><p class="muted">Sin avances registrados.</p></li>
          {/each}
        </ul>
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head"><h3>Resumen semanal por persona</h3><span class="muted live" class:sync={app.sync} id="ppl-upd" title="Se actualiza solo cada 30 segundos">Lun–Vie · actualizado {app.actualizado}</span></div>
    <div class="tscroll" id="tppl">
      {#if personas.length}
        <table>
          <thead><tr><th>Persona</th><th>Días con registro</th><th>Actividades cerradas</th><th>Bloqueos abiertos</th><th>Proyectos</th></tr></thead>
          <tbody>
            {#each personas as p (p.id)}
              <tr><td><b>{p.nombre}</b></td><td class="num" style={p.dias < hab ? 'color:var(--crit)' : ''}>{p.dias}/{hab}</td><td class="num">{p.cerradas}</td><td class="num">{p.bloqueos}</td><td>{clientesDe(p.id).join(', ')}</td></tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="muted">Aún no hay colaboradores. Crea sus cuentas desde Administración.</p>
      {/if}
    </div>
  </div>
</section>
