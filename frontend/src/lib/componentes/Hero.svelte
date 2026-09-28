<!-- Bienvenida + reloj de CDMX + clima (Open-Meteo) -->
<script>
  import { onMount } from 'svelte';
  import { app, AM, BM } from '$lib/estado.svelte.js';
  import { fechaLarga, horaHM, segundos, horaDelDia, primer, plural } from '$lib/util.js';
  import { clima, cargarClima, ICON, wmo } from '$lib/clima.svelte.js';

  let ahora = $state(new Date());
  onMount(() => {
    cargarClima();
    const t = setInterval(() => (ahora = new Date()), 1000);
    const c = setInterval(() => cargarClima(true), 30 * 60 * 1000);
    return () => { clearInterval(t); clearInterval(c); };
  });

  const saludo = $derived.by(() => {
    const h = horaDelDia(ahora);
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  });
  const sub = $derived.by(() => {
    if (!app.S || !app.me) return '';
    if (app.role === 'dev') {
      const bl = BM().length;
      const op = AM().filter((a) => a.estatus !== 'Completado').length;
      return `${saludo}. Tienes ${op} ${plural(op, 'actividad abierta', 'actividades abiertas')}` + (bl ? ` y ${bl} ${plural(bl, 'bloqueo abierto', 'bloqueos abiertos')}.` : '.');
    }
    const n = app.S.alertas.filter((a) => a.proyecto_id).length;
    const m = app.S.kpis.nuevos;
    return `${saludo}. ${n ? `Hay ${n} ${plural(n, 'proyecto que requiere', 'proyectos que requieren')} tu atención` : 'Ningún proyecto requiere tu atención'} y ${m} ${plural(m, 'avance nuevo', 'avances nuevos')} desde ayer.`;
  });
</script>

<div class="hero" id="hero">
  <div class="hi"><p class="label" style="color:inherit;opacity:.8" id="hi-date">{fechaLarga(ahora)}</p><h2 id="hi-greet">Hola, {primer(app.me?.nombre)}</h2><p id="hi-sub">{sub}</p></div>
  <div class="wdg"><span class="label">Hora · Ciudad de México</span><div class="clock" id="clk">{horaHM(ahora)}<small>:{segundos(ahora)}</small></div><span class="muted" style="font-size:.82rem">UTC−6 · horario del centro</span></div>
  <div class="wdg">
    <div class="row" style="justify-content:space-between"><span class="label">Clima</span>
      <select id="wx-city" aria-label="Ciudad" bind:value={clima.ciudad} onchange={() => cargarClima(true)}><option value="cdmx">Ciudad de México</option><option value="mty">Monterrey</option><option value="gdl">Guadalajara</option></select></div>
    <div class="wx">
      <svg id="wx-ic" width="46" height="46" viewBox="0 0 48 48" aria-hidden="true">{@html ICON[clima.icono] || ''}</svg>
      <div><b id="wx-t">{clima.temp}</b></div>
      <div style="font-size:.82rem"><div id="wx-c" style="font-weight:600">{clima.texto}</div><div class="muted" id="wx-m">{clima.detalle}</div></div>
    </div>
    <div class="wxh" id="wx-h">
      {#each clima.horas as h}<div><svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">{@html ICON[wmo(h.codigo)[0]]}</svg><b>{h.temp}°</b>{h.hora}</div>{/each}
    </div>
    <span class="muted" style="font-size:.7rem">Datos de Open-Meteo</span>
  </div>
</div>
