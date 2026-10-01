<!-- Nexo: estructura general (menú, barra superior, vista actual y ventanas) -->
<script>
  import { onMount } from 'svelte';
  import { app, api, entrar, mostrarLogin, refrescar, setFocus, supervisa } from '$lib/estado.svelte.js';
  import { instalarInclinacion } from '$lib/efectos.js';
  import Login from '$lib/componentes/Login.svelte';
  import Menu from '$lib/componentes/Menu.svelte';
  import Aviso from '$lib/componentes/Aviso.svelte';
  import VentanaActividad from '$lib/componentes/VentanaActividad.svelte';
  import VentanaMensaje from '$lib/componentes/VentanaMensaje.svelte';
  import PanelGeneral from '$lib/vistas/PanelGeneral.svelte';
  import Proyectos from '$lib/vistas/Proyectos.svelte';
  import Bloqueos from '$lib/vistas/Bloqueos.svelte';
  import Revisar from '$lib/vistas/Revisar.svelte';
  import Persona from '$lib/vistas/Persona.svelte';
  import Admin from '$lib/vistas/Admin.svelte';
  import MiInicio from '$lib/vistas/MiInicio.svelte';
  import MisActividades from '$lib/vistas/MisActividades.svelte';
  import MisBloqueos from '$lib/vistas/MisBloqueos.svelte';
  import Asistente from '$lib/vistas/Asistente.svelte';
  import Sesiones from '$lib/vistas/Sesiones.svelte';

  const VISTAS = { inicio: PanelGeneral, proyectos: Proyectos, bloqueos: Bloqueos, revisar: Revisar, persona: Persona, admin: Admin, dinicio: MiInicio, misact: MisActividades, misblk: MisBloqueos, asistente: Asistente, sesiones: Sesiones };
  const Vista = $derived(VISTAS[app.vista]);
  const lugarAviso = $derived(app.mensaje ? 'msg' : app.ventana ? 'dlg' : 'body');

  let navOculta = $state(false);
  function alternarMenu() {
    navOculta = !navOculta;
    try { localStorage.setItem('nexo-nav', navOculta ? '1' : '0'); } catch { /* sin almacenamiento */ }
  }

  const textoRol = {
    lider: 'ves a todo el equipo y apruebas lo completado',
    sublider: 'ves tu trabajo y el de tu equipo, y apruebas lo de tu equipo',
    dev: 'solo ves tu trabajo',
  };

  onMount(() => {
    try { navOculta = localStorage.getItem('nexo-nav') === '1'; } catch { /* sin almacenamiento */ }

    // ¿Ya había sesión?
    (async () => {
      try {
        const d = await api('/api/auth', { sinRedireccion: true });
        if (!d.usuario) return mostrarLogin();
        await entrar(d.usuario);
      } catch {
        mostrarLogin();
      }
    })();

    // Actualización automática cada 30 s y al volver a la pestaña
    const intervalo = setInterval(refrescar, 30_000);
    const alVolver = () => { if (!document.hidden) refrescar(); };
    document.addEventListener('visibilitychange', alVolver);
    const quitarInclinacion = instalarInclinacion();

    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
      quitarInclinacion();
    };
  });
</script>

{#if app.S}
  <div class="app" class:collapsed={navOculta}>
    <Menu />
    <main>
      <div class="topbar">
        <div class="row" style="gap:10px;flex-wrap:nowrap">
          <button class="navtoggle" id="navtoggle" type="button" aria-label={navOculta ? 'Mostrar menú' : 'Ocultar menú'} aria-expanded={!navOculta} onclick={alternarMenu}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none" /></svg></button>
          <p class="rolechip" id="rolechip">Sesión de <b>{app.me?.nombre}</b> · {textoRol[app.role] || ''}</p>
        </div>
        <label class="focusbar" class:on={!!app.focus} id="focusbar" hidden={!supervisa()}>Revisando a
          <select id="focus" aria-label="Colaborador a revisar" value={app.focus} onchange={(e) => setFocus(e.currentTarget.value)}>
            <option value={0}>Todo el equipo</option>
            {#each app.S.personas || [] as p (p.id)}<option value={p.id}>{p.nombre}</option>{/each}
          </select>
        </label>
      </div>
      {#key app.vista}
        {#if Vista}<Vista />{/if}
      {/key}
    </main>
  </div>
{/if}

<VentanaActividad />
<VentanaMensaje />
{#if lugarAviso === 'body'}<Aviso />{/if}
<Login />
