<!-- Chips de enlaces (Drive, Excel, Miro…) que abren en otra pestaña -->
<script>
  import { TIPO_LBL } from '$lib/util.js';
  let { enlaces = [] } = $props();
</script>

{#each enlaces as l (l.id ?? l.url)}<a class="lk" href={l.url} target="_blank" rel="noopener noreferrer" title={l.titulo || l.url}>{TIPO_LBL[l.tipo] || l.tipo}</a>{/each}
