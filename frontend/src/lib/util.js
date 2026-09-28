// Utilidades puras: formatos, colores e íconos (sin estado)

export const TZ = 'America/Mexico_City';
export const COLS = ['Por hacer', 'En progreso', 'Bloqueado', 'Completado'];
export const TIPO_LBL = { drive: 'Drive', excel: 'Excel', miro: 'Miro', otro: 'Enlace' };
export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const ROL_LBL = { lider: 'Líder del equipo', sublider: 'Sublíder', dev: 'Colaborador' };
export const ROL_CORTO = { lider: 'Líder', sublider: 'Sublíder', dev: 'Colaborador' };
export const TIPOS_BLOQUEO = ['Accesos / permisos', 'Dependencia del cliente', 'Dependencia interna', 'Técnico / bug', 'Información faltante', 'Infraestructura'];

export const stC = (s) => ({ 'Bloqueado': 's-bloq', 'En progreso': 's-prog', 'En revisión': 's-rev', 'Completado': 's-ok', 'Por hacer': 's-todo' })[s] || 's-todo';
export const initials = (n) => String(n || '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
export const primer = (n) => String(n || '').split(' ')[0];
export const plural = (n, uno, varios) => (n === 1 ? uno : varios);
export const toDM = (iso) => {
  if (!iso) return '—';
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}`;
};
export const fechaCorta = (iso) => {
  const [, m, d] = iso.split('-');
  return `${+d} ${MESES[+m - 1]}`;
};
export const corto = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return 'enlace';
  }
};

const fmt = (opciones) => new Intl.DateTimeFormat('es-MX', { timeZone: TZ, ...opciones });
export const diaISO = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export const fechaHora = (ts) => fmt({ day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts));
export const horaHMS = (d = new Date()) => fmt({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
export const horaHM = (d = new Date()) => fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
export const segundos = (d = new Date()) => String(fmt({ second: 'numeric' }).format(d)).padStart(2, '0');
export const fechaLarga = (d = new Date()) => {
  const f = fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  return f.charAt(0).toUpperCase() + f.slice(1);
};
export const horaDelDia = (d = new Date()) => +new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(d) % 24;

// Hora corta si es de hoy; si no, "dd/mm hh:mm"
export function hora(ts, hoy) {
  const d = new Date(ts);
  const dia = diaISO(d);
  return dia === hoy ? horaHM(d) : `${toDM(dia)} ${horaHM(d)}`;
}

// "21 al 27 sep 2026" · "28 sep al 4 oct 2026" · "28 dic 2026 al 3 ene 2027"
export function rangoFechas(ini, fin) {
  const [y1, m1, d1] = ini.split('-').map(Number);
  const [y2, m2, d2] = fin.split('-').map(Number);
  if (y1 !== y2) return `${d1} ${MESES[m1 - 1]} ${y1} al ${d2} ${MESES[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${d1} ${MESES[m1 - 1]} al ${d2} ${MESES[m2 - 1]} ${y2}`;
  return `${d1} al ${d2} ${MESES[m2 - 1]} ${y2}`;
}

export const resumen = (f) => `${f.cliente.toUpperCase()} · ${f.titulo} | ${f.avance_pct}% | ${f.estatus}`;
export const barColor = (st) => (st === 'Bloqueado' ? 'var(--crit)' : st === 'Completado' ? 'var(--ok)' : 'var(--accent)');

export const ST_COLOR = { 'Por hacer': 'var(--muted)', 'En progreso': 'var(--accent)', 'Bloqueado': 'var(--crit)', 'Completado': 'var(--ok)' };
const AV_COLORS = ['#2B59C3', '#1C8556', '#A86A12', '#7A4CC2', '#C03C28', '#0E7C86', '#B5487F', '#4A5A70'];
export const avColor = (id) => AV_COLORS[Math.abs(+id || 0) % AV_COLORS.length];

// Enlaces sin duplicar (por URL)
export function sinDuplicados(enlaces) {
  const vistos = new Set();
  return enlaces.filter((l) => !vistos.has(l.url) && vistos.add(l.url));
}
