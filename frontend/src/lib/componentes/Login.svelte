<!-- Pantalla de inicio de sesión con los cubos 3D flotando al fondo -->
<script>
  import { app, api, entrar } from '$lib/estado.svelte.js';
  import { toast } from '$lib/aviso.svelte.js';
  import Cubo from './Cubo.svelte';

  // [izquierda %, arriba %, retraso s, tamaño px] de cada cubo del fondo
  const CUBOS = [[8, 14, 0, 70], [80, 10, -2, 46], [14, 72, -4, 52], [84, 66, -1, 84], [46, 86, -3, 36], [60, 4, -5, 28]];

  let email = $state('');
  let password = $state('');
  let recordar = $state(true);
  let error = $state('');
  let verClave = $state(false);
  let ocupado = $state(false);

  async function enviar(e) {
    e.preventDefault();
    const correo = email.trim().toLowerCase();
    if (!correo || !password) return (error = 'Escribe tu correo y tu contraseña.');
    ocupado = true;
    try {
      const d = await api('/api/auth', { method: 'POST', body: { email: correo, password, recordar }, sinRedireccion: true });
      error = '';
      password = '';
      await entrar(d.usuario);
    } catch (err) {
      error = err.message;
    } finally {
      ocupado = false;
    }
  }
</script>

<div class="login" class:checking={app.verificando} id="login" hidden={!!app.S}>
  <div class="bgcubes" aria-hidden="true">
    {#each CUBOS as [x, y, retraso, s]}<span class="bgc" style="left:{x}%;top:{y}%;animation-delay:{retraso}s"><Cubo {s} /></span>{/each}
  </div>
  <div class="box">
    <div class="brand" style="padding:0"><Cubo s={40} /><div><h2 style="font-size:1.4rem">Nexo</h2><span class="muted" style="font-size:.8rem">Área de Desarrollo de Software</span></div></div>
    <div><h3 style="font-size:1.15rem">Inicia sesión</h3><p class="muted" style="font-size:.86rem;margin-top:4px">Usa tu correo de la empresa. Tu rol se asigna automáticamente.</p></div>
    <form id="lgform" novalidate onsubmit={enviar}>
      <div class="field"><label for="lg-mail">Correo de la empresa</label><input type="email" id="lg-mail" inputmode="email" autocomplete="username" placeholder="nombre.apellido@tuempresa.mx" bind:value={email} /></div>
      <div class="field">
        <div class="row" style="justify-content:space-between"><label for="lg-pass">Contraseña</label><button type="button" class="btn ghost sm" id="lg-forgot" style="border:0;padding:0" onclick={() => toast('Pide a tu líder que restablezca tu contraseña desde Administración.')}>¿La olvidaste?</button></div>
        <div class="row" style="flex-wrap:nowrap"><input type={verClave ? 'text' : 'password'} id="lg-pass" autocomplete="current-password" style="flex:1" bind:value={password} /><button type="button" class="btn ghost sm" id="lg-eye" style="flex:none" onclick={() => (verClave = !verClave)}>{verClave ? 'Ocultar' : 'Ver'}</button></div>
      </div>
      <label class="row" style="font-size:.84rem;gap:8px"><input type="checkbox" id="lg-rem" style="accent-color:var(--accent)" bind:checked={recordar} />Mantener sesión iniciada</label>
      <p class="err" id="lg-err" role="alert" hidden={!error}>{error}</p>
      <button class="btn gbtn" type="submit" id="lg-btn" disabled={ocupado}>Iniciar sesión</button>
    </form>
  </div>
</div>
