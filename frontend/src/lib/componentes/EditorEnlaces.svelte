<!-- Agregar y quitar enlaces (Drive, Excel, Miro…). Los que ya existían y se quitan van a `eliminar`. -->
<script>
  import { TIPO_LBL, corto } from '$lib/util.js';
  import { toast } from '$lib/aviso.svelte.js';

  let { prefijo, items = $bindable([]), eliminar = $bindable([]), deshabilitado = false } = $props();
  let tipo = $state('drive');
  let url = $state('');

  function agregar() {
    const u = url.trim();
    if (!u) return;
    if (!/^https?:\/\/\S+$/i.test(u)) return toast('Pega un enlace completo que empiece con https://');
    items = [...items, { tipo, url: u }];
    url = '';
  }
  function quitar(i) {
    const x = items[i];
    items = items.filter((_, k) => k !== i);
    if (x?.id) eliminar = [...eliminar, x.id];
  }
</script>

<div class="row" id={prefijo === 'f' ? 'f-lrow' : undefined} style="flex-wrap:nowrap">
  <select id="{prefijo}-lt" aria-label="Tipo de enlace" style="width:auto;flex:none" bind:value={tipo} disabled={deshabilitado}><option value="drive">Drive</option><option value="excel">Excel</option><option value="miro">Miro</option><option value="otro">Otro</option></select>
  <input type="url" id="{prefijo}-lu" placeholder="Pega el enlace y Enter" aria-label="URL del enlace" bind:value={url} disabled={deshabilitado} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }} />
  <button type="button" class="btn ghost sm" id="{prefijo}-la" style="flex:none" onclick={agregar} disabled={deshabilitado}>Agregar</button>
</div>
<div class="links" id="{prefijo}-ll">
  {#each items as l, i (l.id ?? l.url + i)}<span class="lk">{TIPO_LBL[l.tipo] || l.tipo} · <a href={l.url} target="_blank" rel="noopener noreferrer">{corto(l.url)}</a><button type="button" class="lkx" aria-label="Quitar enlace" onclick={() => quitar(i)}>×</button></span>{/each}
</div>
