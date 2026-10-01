import { handler, falla } from '../lib/http.js';
import { str } from '../lib/validar.js';
import { hoyMX } from '../lib/fechas.js';

// POST (solo líder): manda la pregunta al flujo "Nexo · Asistente" de n8n y devuelve su respuesta.
// Variables: N8N_ASISTENTE_URL (Production URL del webhook) y N8N_SECRET (el mismo valor que en n8n).
export default handler(
  ['POST'],
  async ({ user, body }) => {
    const url = process.env.N8N_ASISTENTE_URL;
    const secreto = process.env.N8N_SECRET;
    if (!url || !secreto) falla(503, 'El asistente todavía no está configurado (faltan N8N_ASISTENTE_URL y N8N_SECRET).');

    const pregunta = str(body.pregunta, 1000);
    if (!pregunta) falla(400, 'Escribe tu pregunta.');
    const conversacion = str(body.conversacion, 64).replace(/[^\w-]/g, '') || 'general';

    const ctrl = new AbortController();
    const reloj = setTimeout(() => ctrl.abort(), 55_000);
    let r;
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Nexo-Secret': secreto },
        body: JSON.stringify({ pregunta, sesion: `u${user.id}-${conversacion}`, usuario: user.nombre, hoy: hoyMX() }),
        signal: ctrl.signal,
      });
    } catch (err) {
      falla(504, err.name === 'AbortError' ? 'La IA tardó demasiado en responder. Intenta con una pregunta más concreta.' : 'No se pudo contactar al asistente.');
    } finally {
      clearTimeout(reloj);
    }
    if (!r.ok) {
      console.error('n8n asistente', r.status, await r.text().catch(() => ''));
      falla(502, 'El asistente no pudo responder. Revisa las ejecuciones del flujo en n8n.');
    }
    const d = await r.json().catch(() => ({}));
    const respuesta = str(d.respuesta ?? d.output, 20_000);
    if (!respuesta) falla(502, 'El asistente respondió vacío.');
    return { respuesta };
  },
  { rol: 'lider' }
);
