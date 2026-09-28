// Efectos visuales (idénticos a la versión anterior)

const reducirMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Acción `use:contar={n}`: al aparecer, el número sube de 0 a n (0.7 s, curva suave).
// En actualizaciones posteriores el número cambia directo, sin animar.
export function contar(node, valor) {
  let raf;
  const poner = (v) => { node.textContent = String(v); };
  const animar = (v) => {
    if (reducirMovimiento() || !/^\d+$/.test(String(v)) || !+v) return poner(v);
    const n = +v;
    const t0 = performance.now();
    const paso = (now) => {
      const k = Math.min(1, (now - t0) / 700);
      node.textContent = String(Math.round(n * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
  };
  animar(valor);
  return {
    update(v) { cancelAnimationFrame(raf); poner(v); },
    destroy() { cancelAnimationFrame(raf); },
  };
}

// Inclinación 3D de tarjetas, KPIs y widgets al mover el mouse. Se instala una vez para toda la página.
const INCLINABLES = '.kpi,.pcard,.wdg,.hero .hi,.card,.alert';
export function instalarInclinacion() {
  let actual = null;
  const mover = (e) => {
    if (reducirMovimiento() || e.pointerType === 'touch') return;
    const el = e.target.closest?.(INCLINABLES);
    if (actual && actual !== el) actual.style.transform = '';
    actual = el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    const m = el.classList.contains('card') ? 5 : 7;
    el.style.transform = `perspective(800px) rotateX(${(-y * m).toFixed(2)}deg) rotateY(${(x * m).toFixed(2)}deg) translateZ(6px)`;
  };
  const salir = () => { if (actual) actual.style.transform = ''; };
  document.addEventListener('pointermove', mover);
  document.documentElement.addEventListener('pointerleave', salir);
  return () => {
    document.removeEventListener('pointermove', mover);
    document.documentElement.removeEventListener('pointerleave', salir);
  };
}
