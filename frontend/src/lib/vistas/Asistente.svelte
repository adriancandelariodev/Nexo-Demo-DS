<!-- Asistente IA (solo líder): chat con el flujo "Nexo · Asistente" de n8n + alertas del detector de riesgos -->
<script>
  import { onMount, tick } from 'svelte';
  import { app, api } from '$lib/estado.svelte.js';
  import { initials, toDM } from '$lib/util.js';

  const SUGERENCIAS = [
    '¿Quién tiene más riesgo esta semana?',
    '¿Cómo le fue a cada persona en las reuniones de este mes?',
    'Resume la última reunión con un cliente',
    '¿Qué compromisos de reuniones están vencidos?',
  ];

  const conversacion = Math.random().toString(36).slice(2, 10);
  let msgs = $state([{ rol: 'ia', texto: `Hola, ${app.me?.nombre?.split(' ')[0] || ''}. Puedo responder sobre las actividades, bloqueos y reuniones del equipo. ¿Qué quieres revisar?` }]);
  let pregunta = $state('');
  let esperando = $state(false);
  let D = $state(null);
  let log;

  // Texto de la IA → HTML seguro: se escapa todo y solo se permiten **negritas**, listas con "- " y párrafos.
  function formato(t) {
    const esc = String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return esc
      .split(/\n{2,}/)
      .map((bloque) => {
        const lineas = bloque.split('\n').filter((l) => l.trim());
        const neg = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        if (lineas.length && lineas.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          return '<ul>' + lineas.map((l) => `<li>${neg(l.replace(/^\s*([-*•]|\d+\.)\s+/, ''))}</li>`).join('') + '</ul>';
        }
        return lineas
          .map((l) => (/^\s*([-*•])\s+/.test(l) ? `<ul><li>${neg(l.replace(/^\s*[-*•]\s+/, ''))}</li></ul>` : `<p>${neg(l.replace(/^#+\s*/, ''))}</p>`))
          .join('');
      })
      .join('');
  }

  async function bajar() {
    await tick();
    if (log) log.scrollTop = log.scrollHeight;
  }

  async function preguntar(texto) {
    const q = String(texto ?? pregunta).trim();
    if (!q || esperando) return;
    pregunta = '';
    msgs.push({ rol: 'yo', texto: q });
    esperando = true;
    bajar();
    try {
      const d = await api('/api/asistente', { method: 'POST', body: { pregunta: q, conversacion } });
      msgs.push({ rol: 'ia', texto: d.respuesta });
    } catch (err) {
      msgs.push({ rol: 'ia', texto: err.message, error: true });
    } finally {
      esperando = false;
      bajar();
    }
  }

  onMount(async () => {
    try {
      D = await api('/api/sesiones');
    } catch {
      D = { alertas: [], asistente: true };
    }
  });
</script>

<section data-view="asistente" class="enter" style="display:grid;gap:20px">
  <div class="page-head">
    <div>
      <p class="label">Inteligencia</p>
      <h2>Asistente del equipo</h2>
      <p class="muted" style="font-size:.88rem;max-width:62ch;margin-top:4px">Pregunta en lenguaje natural. La IA consulta actividades, bloqueos y reuniones transcritas, y responde con los datos que encontró.</p>
    </div>
  </div>

  {#if D && !D.asistente}
    <div class="notice"><span>El asistente aún no está conectado. Configura <b>N8N_ASISTENTE_URL</b> y <b>N8N_SECRET</b> en el backend (ver n8n/README.md).</span></div>
  {/if}

  <div class="grid-2">
    <div class="panel chat">
      <div class="chat-head"><span class="avatar ai">IA</span><div><b style="font-size:.92rem">Asistente Nexo</b><p class="muted" style="font-size:.76rem">Solo lectura · no modifica nada en Nexo</p></div></div>
      <div class="chat-log" bind:this={log} aria-live="polite">
        {#each msgs as m, i (i)}
          <div class="msg" class:yo={m.rol === 'yo'}>
            {#if m.rol === 'yo'}
              <span class="avatar" style="background:var(--accent);color:var(--accent-ink)">{initials(app.me?.nombre)}</span>
              <div class="bubble">{m.texto}</div>
            {:else}
              <span class="avatar ai">IA</span>
              <div class="bubble" class:error={m.error}>{@html formato(m.texto)}</div>
            {/if}
          </div>
        {/each}
        {#if esperando}
          <div class="msg"><span class="avatar ai">IA</span><div class="bubble"><span class="escribiendo" aria-label="Pensando"><span></span><span></span><span></span></span></div></div>
        {/if}
      </div>
      <div>
        <div class="chips">
          {#each SUGERENCIAS as s}<button class="chip" type="button" disabled={esperando} onclick={() => preguntar(s)}>{s}</button>{/each}
        </div>
        <form class="chat-in" onsubmit={(e) => { e.preventDefault(); preguntar(); }}>
          <input type="text" id="pregunta-ia" bind:value={pregunta} maxlength="1000" placeholder="Ej. ¿Cómo le fue a Ana en las juntas de septiembre?" autocomplete="off" aria-label="Pregunta para la IA" />
          <button class="btn" type="submit" disabled={esperando || !pregunta.trim()}>Preguntar</button>
        </form>
        <p class="chat-nota">La IA sugiere; la evaluación final es tuya. Cada colaborador ve sus propias métricas de comunicación.</p>
      </div>
    </div>

    <div style="display:grid;gap:16px;align-content:start">
      <div class="panel">
        <div class="panel-head"><h3>Alertas del día</h3><span class="pill s-ai">Detector de riesgos</span></div>
        {#if !D}
          <p class="muted">Cargando…</p>
        {:else if !D.alertas.length}
          <p class="muted" style="font-size:.88rem">Sin alertas. El detector corre de lunes a viernes a las 9:00.</p>
        {:else}
          <p class="muted mono" style="font-size:.74rem;margin-bottom:10px">Generadas el {toDM(D.alertas[0].fecha)}</p>
          <div class="alertas-ia">
            {#each D.alertas as a (a.id)}
              <div class="alerta-ia"><i class={a.nivel}></i><div><b style="font-size:.9rem">{a.nombre ? a.nombre + ' · ' : ''}{a.titulo}</b><p>{a.detalle}</p></div></div>
            {/each}
          </div>
        {/if}
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Qué puede consultar</h3></div>
        <ul class="muted" style="margin:0;padding-left:18px;display:grid;gap:4px;font-size:.86rem">
          <li>Actividades, avances, bloqueos y proyectos</li>
          <li>Reuniones de Google Meet: resumen, acuerdos y compromisos</li>
          <li>Participación y claridad de las actualizaciones por persona</li>
          <li>Rendimiento de la semana y riesgos de hoy</li>
        </ul>
      </div>
    </div>
  </div>
</section>
