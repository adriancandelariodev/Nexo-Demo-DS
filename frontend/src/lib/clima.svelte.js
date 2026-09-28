// Clima de Open-Meteo, compartido entre el inicio del líder y el del colaborador (se consulta cada 30 min)
const CIUDADES = { cdmx: [19.4326, -99.1332], mty: [25.6866, -100.3161], gdl: [20.6597, -103.3496] };

// Íconos fijos definidos aquí (no vienen de datos externos), por eso se insertan con {@html}
export const ICON = {
  sol: '<circle cx="24" cy="24" r="9" fill="#F2B233"/><g stroke="#F2B233" stroke-width="3" stroke-linecap="round"><path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.5 10.5l3.5 3.5M34 34l3.5 3.5M10.5 37.5l3.5-3.5M34 14l3.5-3.5"/></g>',
  ps: '<circle cx="18" cy="17" r="8" fill="#F2B233"/><path d="M16 38h20a8 8 0 0 0 0-16 11 11 0 0 0-21 4 6 6 0 0 0 1 12z" fill="#9FB3C8"/>',
  ll: '<path d="M12 30h24a8 8 0 0 0 0-16 11 11 0 0 0-21 4 6 6 0 0 0-3 12z" fill="#8497AD"/><g stroke="#4A90D9" stroke-width="3" stroke-linecap="round"><path d="M17 35l-2 6M25 35l-2 6M33 35l-2 6"/></g>',
  nb: '<path d="M12 34h24a8 8 0 0 0 0-16 11 11 0 0 0-21 4 6 6 0 0 0-3 12z" fill="#9FB3C8"/>',
};

// Códigos WMO de Open-Meteo → icono y texto
export function wmo(c) {
  if (c === 0) return ['sol', 'Despejado'];
  if (c === 1) return ['sol', 'Mayormente despejado'];
  if (c === 2) return ['ps', 'Parcialmente nublado'];
  if (c === 3) return ['nb', 'Nublado'];
  if (c === 45 || c === 48) return ['nb', 'Niebla'];
  if (c >= 51 && c <= 57) return ['ll', 'Llovizna'];
  if (c >= 61 && c <= 67) return ['ll', 'Lluvia'];
  if (c >= 71 && c <= 77) return ['nb', 'Nieve'];
  if (c >= 80 && c <= 82) return ['ll', 'Chubascos'];
  if (c >= 95) return ['ll', 'Tormenta'];
  return ['nb', 'Nublado'];
}

export const clima = $state({ ciudad: 'cdmx', icono: '', temp: '--°', texto: 'Cargando…', detalle: '', horas: [] });

let ultimo = { ciudad: '', t: 0 };
export async function cargarClima(forzar = false) {
  if (!forzar && ultimo.ciudad === clima.ciudad && Date.now() - ultimo.t < 30 * 60 * 1000) return;
  ultimo = { ciudad: clima.ciudad, t: Date.now() };
  const [la, lo] = CIUDADES[clima.ciudad];
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FMexico_City&forecast_days=2`);
    if (!r.ok) throw new Error();
    const d = await r.json();
    const [ic, txt] = wmo(d.current.weather_code);
    clima.icono = ic;
    clima.temp = Math.round(d.current.temperature_2m) + '°';
    clima.texto = txt;
    clima.detalle = `Máx ${Math.round(d.daily.temperature_2m_max[0])}° · Mín ${Math.round(d.daily.temperature_2m_min[0])}° · Lluvia ${d.daily.precipitation_probability_max[0] ?? 0}%`;
    let i = d.hourly.time.findIndex((t) => t > d.current.time);
    if (i < 0) i = 0;
    clima.horas = [i, i + 3, i + 6, i + 9]
      .filter((k) => k < d.hourly.time.length)
      .map((k) => ({ codigo: d.hourly.weather_code[k], temp: Math.round(d.hourly.temperature_2m[k]), hora: d.hourly.time[k].slice(11, 16) }));
  } catch {
    ultimo.t = 0;
    Object.assign(clima, { icono: 'nb', temp: '--°', texto: 'Clima no disponible', detalle: '', horas: [] });
  }
}
