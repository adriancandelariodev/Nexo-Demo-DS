// Fechas de calendario como texto 'YYYY-MM-DD' en la zona horaria del equipo.
export const TZ = 'America/Mexico_City';

const toDate = (iso) => new Date(iso + 'T12:00:00Z');

export function hoyMX(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDays(iso, n) {
  const t = toDate(iso);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

// 0 = domingo … 6 = sábado
export const dow = (iso) => toDate(iso).getUTCDay();

export function lunesDe(iso) {
  const d = dow(iso);
  return addDays(iso, d === 0 ? -6 : 1 - d);
}

export function isoWeek(iso) {
  const t = new Date(iso + 'T00:00:00Z');
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - inicio) / 864e5 + 1) / 7);
}

// Días hábiles (lun–vie) después de `desde` y hasta `hasta` inclusive.
export function habilesEntre(desde, hasta) {
  let n = 0;
  let d = addDays(desde, 1);
  while (d <= hasta && n < 60) {
    const w = dow(d);
    if (w > 0 && w < 6) n++;
    d = addDays(d, 1);
  }
  return n;
}
