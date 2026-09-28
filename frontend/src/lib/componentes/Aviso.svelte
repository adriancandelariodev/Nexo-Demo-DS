<script>
  import { aviso } from '$lib/aviso.svelte.js';
</script>

<div class="toast" id="toast" role="status" hidden={!aviso.visible}>{aviso.texto}</div>
