<!-- Menú lateral: "Jefatura/Mi equipo" para quien supervisa y "Mi trabajo" para quien registra -->
<script>
  import { app, api, AE, BE, BM, supervisa, registra, irA, setFocus, mostrarLogin, abrirActividad } from '$lib/estado.svelte.js';
  import { ROL_LBL, initials } from '$lib/util.js';
  import Cubo from './Cubo.svelte';

  const porRevisar = $derived(supervisa() ? AE().filter((a) => a.estatus === 'Completado' && !a.revisada).length : 0);
  const bloqEquipo = $derived(supervisa() ? BE().length : 0);
  const misBloq = $derived(registra() ? BM().length : 0);
  const actual = (v) => (app.vista === v ? 'page' : undefined);

  async function salir() {
    await api('/api/auth', { method: 'DELETE', sinRedireccion: true }).catch(() => {});
    mostrarLogin();
    try { history.replaceState(null, '', location.pathname); } catch { /* sin historial */ }
  }
</script>

<aside>
  <div class="brand">
    <Cubo s={30} />
    <div><b>Nexo</b><small>Desarrollo de Software</small></div>
  </div>

  <nav aria-label="Principal" data-role="lider" hidden={!supervisa()}>
    <span class="navsep" id="nav-sep-equipo">{app.role === 'lider' ? 'Jefatura' : 'Mi equipo'}</span>
    <button data-v="inicio" aria-current={actual('inicio')} onclick={() => irA('inicio')}>Panel general</button>
    <button data-v="proyectos" aria-current={actual('proyectos')} onclick={() => irA('proyectos')}>Proyectos</button>
    <button data-v="revisar" aria-current={actual('revisar')} onclick={() => irA('revisar')}>Por revisar <span class="cnt" id="nrev" style="background:var(--ok)" hidden={!porRevisar}>{porRevisar}</span></button>
    <button data-v="bloqueos" aria-current={actual('bloqueos')} onclick={() => irA('bloqueos')}>Bloqueos <span class="cnt" id="nblk" hidden={!bloqEquipo}>{bloqEquipo}</span></button>
    <button data-v="admin" id="nav-admin" hidden={app.role !== 'lider'} aria-current={actual('admin')} onclick={() => irA('admin')}>Administración</button>
    <span class="navsep">Inteligencia</span>
    <button data-v="asistente" hidden={app.role !== 'lider'} aria-current={actual('asistente')} onclick={() => irA('asistente')}>Asistente IA <span class="nuevo">IA</span></button>
    <button data-v="sesiones" aria-current={actual('sesiones')} onclick={() => irA('sesiones')}>Sesiones <span class="nuevo">IA</span></button>
    <span class="navsep">Equipo</span>
    <div id="teamnav" style="display:contents">
      {#each app.S.personas || [] as p (p.id)}
        <button class="pbtn" data-v="persona" data-p={p.id} aria-current={app.vista === 'persona' && app.focus === p.id ? 'page' : undefined} onclick={() => { setFocus(p.id); irA('persona'); }}><span class="mini">{initials(p.nombre)}</span>{p.nombre}</button>
      {/each}
    </div>
  </nav>

  <nav aria-label="Principal" data-role="dev" hidden={!registra()}>
    <span class="navsep">Mi trabajo</span>
    <button data-v="dinicio" aria-current={actual('dinicio')} onclick={() => irA('dinicio')}>Inicio</button>
    <button type="button" data-new="En progreso" onclick={() => abrirActividad('nuevo', null, 'En progreso')}>+ Registrar actividad</button>
    <button data-v="misact" aria-current={actual('misact')} onclick={() => irA('misact')}>Mis actividades</button>
    <button data-v="misblk" aria-current={actual('misblk')} onclick={() => irA('misblk')}>Mis bloqueos <span class="cnt" id="nmblk" hidden={!misBloq}>{misBloq}</span></button>
    <button data-v="sesiones" hidden={app.role !== 'dev'} aria-current={actual('sesiones')} onclick={() => irA('sesiones')}>Mis sesiones</button>
  </nav>

  <div class="me"><span class="avatar" id="me-av">{initials(app.me?.nombre)}</span><div class="who"><b id="me-name">{app.me?.nombre}</b><small id="me-role">{ROL_LBL[app.role] || app.role}</small></div><button id="logout" type="button" onclick={salir}>Salir</button></div>
</aside>
