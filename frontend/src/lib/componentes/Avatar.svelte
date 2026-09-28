<!-- Círculo con iniciales; el color depende de la persona -->
<script>
  import { avColor, initials } from '$lib/util.js';
  let { id, nombre } = $props();
</script>

<span class="av" style="background:{avColor(id)}" title={nombre}>{initials(nombre)}</span>
