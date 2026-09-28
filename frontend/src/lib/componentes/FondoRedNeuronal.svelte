<!--
  Fondo animado del inicio de sesión: una red neuronal en 3D.
  Las neuronas viven en un espacio 3D (x = capa, y = posición en la capa, z = profundidad);
  la cámara gira despacio y sigue un poco al mouse, y pulsos de luz recorren las conexiones.
  Con "reducir movimiento" activado se dibuja una sola vez, sin animación.
-->
<script>
  import { onMount } from 'svelte';

  let { activo = true } = $props();
  let host = $state();

  // Paleta del logo: violeta → índigo → azul → cian
  const STOPS = [[123, 63, 228], [79, 91, 234], [47, 140, 240], [54, 198, 242]];
  function rgb(t) {
    t = Math.max(0, Math.min(0.999, t)) * 3;
    const i = t | 0, f = t - i, a = STOPS[i], b = STOPS[i + 1];
    return a.map((v, j) => Math.round(v + (b[j] - v) * f));
  }
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  const CAPAS = [5, 8, 10, 10, 8, 4];
  const ETIQUETAS = ['input', 'embedding', 'hidden_1', 'hidden_2', 'attention', 'output'];

  onMount(() => {
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const fondo = document.createElement('canvas'); // capa estática (degradados y viñeta)
    const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Semilla fija: la red sale igual cada vez
    let seed = 11;
    const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    // Modelo 3D de la red
    const nodos = CAPAS.map((n, li) =>
      Array.from({ length: n }, (_, j) => ({
        x: li - (CAPAS.length - 1) / 2,
        y: (j + 0.5) / n - 0.5,
        z: (R() - 0.5) * 0.9,
        fase: R() * Math.PI * 2,
        color: rgb(li / (CAPAS.length - 1)),
      }))
    );
    const conexiones = [];
    for (let li = 0; li < nodos.length - 1; li++) {
      for (const a of nodos[li]) for (const b of nodos[li + 1]) {
        const w = R();
        if (w >= 0.35) conexiones.push({ a, b, w, ca: a.color, cb: b.color });
      }
    }
    const pulsos = Array.from({ length: 42 }, () => ({ c: conexiones[(R() * conexiones.length) | 0], t: R(), v: 0.12 + R() * 0.22 }));

    // Brillo pre-dibujado por capa (más ligero que shadowBlur en cada cuadro)
    const brillos = CAPAS.map((_, li) => {
      const s = document.createElement('canvas');
      s.width = s.height = 64;
      const g = s.getContext('2d'), c = rgb(li / (CAPAS.length - 1));
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, rgba(c, 0.55)); r.addColorStop(0.35, rgba(c, 0.22)); r.addColorStop(1, rgba(c, 0));
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
      return s;
    });
    const brilloPulso = (() => {
      const s = document.createElement('canvas');
      s.width = s.height = 32;
      const g = s.getContext('2d'), r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      r.addColorStop(0, 'rgba(240,252,255,1)'); r.addColorStop(0.16, 'rgba(191,239,255,1)'); r.addColorStop(0.4, 'rgba(120,215,255,.35)'); r.addColorStop(1, 'rgba(90,200,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 32, 32);
      return s;
    })();

    let W = 0, H = 0, dpr = 1;
    function medir() {
      W = innerWidth; H = innerHeight; dpr = Math.min(1.75, devicePixelRatio || 1);
      for (const c of [canvas, fondo]) { c.width = W * dpr; c.height = H * dpr; }
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      const f = fondo.getContext('2d');
      f.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = f.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#0A0620'); g.addColorStop(0.5, '#070B22'); g.addColorStop(1, '#041426');
      f.fillStyle = g; f.fillRect(0, 0, W, H);
      for (const [px, py, c, a] of [[0.15, 0.2, '#7B3FE4', 0.35], [0.85, 0.8, '#36C6F2', 0.28], [0.8, 0.15, '#2F8CF0', 0.2]]) {
        const r = f.createRadialGradient(W * px, H * py, 0, W * px, H * py, W * 0.45);
        r.addColorStop(0, c + Math.round(a * 255).toString(16).padStart(2, '0'));
        r.addColorStop(1, 'transparent');
        f.fillStyle = r; f.fillRect(0, 0, W, H);
      }
    }

    // Cámara: gira despacio y sigue un poco al mouse
    let mx = 0, my = 0, cx = 0, cy = 0;
    const alMover = (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };

    function proyectar(n, yaw, pitch, t) {
      const flota = Math.sin(t * 0.6 + n.fase) * 0.012;
      let { x, z } = n;
      let y = n.y + flota;
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
      [x, z] = [x * cosY - z * sinY, x * sinY + z * cosY];
      const cosX = Math.cos(pitch), sinX = Math.sin(pitch);
      [y, z] = [y * cosX - z * sinX, y * sinX + z * cosX];
      const D = 5.5, f = D / (D + z);
      const sx = (W * 0.8) / (CAPAS.length - 1), sy = H * 0.76;
      return { X: W / 2 + x * sx * f, Y: H * 0.5 + y * sy * f, f, z };
    }

    function cuadro(ms) {
      const t = ms / 1000;
      cx += (mx - cx) * 0.04; cy += (my - cy) * 0.04;
      const yaw = Math.sin(t * 0.09) * 0.22 + cx * 0.25;
      const pitch = Math.sin(t * 0.07) * 0.1 + cy * 0.2;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(fondo, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      for (const capa of nodos) for (const n of capa) n.p = proyectar(n, yaw, pitch, t);

      // Conexiones (curvas con degradado; las lejanas más tenues)
      for (const c of conexiones) {
        const a = c.a.p, b = c.b.p, prof = (a.f + b.f) / 2;
        const alfa = (0.05 + c.w * 0.25) * Math.min(1, prof * 1.05);
        const lg = ctx.createLinearGradient(a.X, a.Y, b.X, b.Y);
        lg.addColorStop(0, rgba(c.ca, alfa)); lg.addColorStop(1, rgba(c.cb, alfa));
        ctx.strokeStyle = lg; ctx.lineWidth = (0.6 + c.w * 1.4) * prof;
        const k = 60 * prof;
        ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.bezierCurveTo(a.X + k, a.Y, b.X - k, b.Y, b.X, b.Y); ctx.stroke();
      }

      // Pulsos de luz que viajan por la curva
      for (const p of pulsos) {
        if (!reducir) { p.t += p.v / 60; if (p.t > 1) { p.t = 0; p.c = conexiones[(Math.random() * conexiones.length) | 0]; } }
        const a = p.c.a.p, b = p.c.b.p, prof = (a.f + b.f) / 2, k = 60 * prof, u = p.t, m = 1 - u;
        const X = m * m * m * a.X + 3 * m * m * u * (a.X + k) + 3 * m * u * u * (b.X - k) + u * u * u * b.X;
        const Y = m * m * m * a.Y + 3 * m * m * u * a.Y + 3 * m * u * u * b.Y + u * u * u * b.Y;
        const s = 13 * prof;
        ctx.globalAlpha = Math.sin(Math.PI * u) * 0.75 + 0.25;
        ctx.drawImage(brilloPulso, X - s / 2, Y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;

      // Neuronas (de la más lejana a la más cercana)
      const todas = nodos.flatMap((capa, li) => capa.map((n) => ({ n, li }))).sort((a, b) => b.n.p.z - a.n.p.z);
      for (const { n, li } of todas) {
        const { X, Y, f } = n.p, late = 1 + Math.sin(t * 1.6 + n.fase) * 0.08;
        const g = 62 * f * late;
        ctx.drawImage(brillos[li], X - g / 2, Y - g / 2, g, g);
        ctx.fillStyle = rgba(n.color, 1);
        ctx.beginPath(); ctx.arc(X, Y, 4.6 * f, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(X, Y, 1.9 * f, 0, Math.PI * 2); ctx.fill();
      }

      // Etiquetas de las capas
      ctx.font = '600 12px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      nodos.forEach((capa, li) => {
        const x = capa.reduce((s, n) => s + n.p.X, 0) / capa.length;
        ctx.fillStyle = rgba(rgb(li / (CAPAS.length - 1)), 0.8);
        ctx.fillText(ETIQUETAS[li], x, H * 0.07);
      });

      // Viñeta
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.75);
      v.addColorStop(0, 'rgba(5,6,20,0)'); v.addColorStop(1, 'rgba(5,6,20,.55)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    }

    let raf = 0;
    const bucle = (ms) => { cuadro(ms); raf = requestAnimationFrame(bucle); };
    const arrancar = () => {
      cancelAnimationFrame(raf);
      if (!activo || document.hidden) return;
      if (reducir) cuadro(0);
      else raf = requestAnimationFrame(bucle);
    };

    medir();
    let espera;
    const alRedimensionar = () => { clearTimeout(espera); espera = setTimeout(() => { medir(); if (reducir) cuadro(0); }, 120); };
    addEventListener('resize', alRedimensionar);
    addEventListener('pointermove', alMover);
    document.addEventListener('visibilitychange', arrancar);
    document.fonts?.ready.then(() => { if (reducir) cuadro(0); });
    arrancar();
    detener = () => cancelAnimationFrame(raf);
    reanudar = arrancar;

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', alRedimensionar);
      removeEventListener('pointermove', alMover);
      document.removeEventListener('visibilitychange', arrancar);
      canvas.remove();
    };
  });

  // Solo se anima mientras el inicio de sesión está visible
  let detener = () => {};
  let reanudar = () => {};
  $effect(() => { if (activo) reanudar(); else detener(); });
</script>

<div class="fondo-red" bind:this={host} aria-hidden="true"></div>
