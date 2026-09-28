<!-- Bloqueos propios -->
<script>
  import { BM } from '$lib/estado.svelte.js';
  import TablaBloqueos from '$lib/componentes/TablaBloqueos.svelte';
</script>

<section data-view="misblk" class="enter" style="display:grid;gap:20px">
  <div class="page-head">
    <div><p class="label">Mi trabajo</p><h2>Mis bloqueos</h2></div>
    <p class="muted" style="font-size:.88rem">Márcalos como resueltos en cuanto se destraben.</p>
  </div>
  <div class="panel tscroll" id="tmblk"><TablaBloqueos list={BM()} modo="resolver" /></div>
</section>
