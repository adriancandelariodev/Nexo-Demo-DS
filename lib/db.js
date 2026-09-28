import pg from 'pg';

// Las columnas DATE se devuelven como 'YYYY-MM-DD' para no moverlas de día por la zona horaria.
pg.types.setTypeParser(1082, (v) => v);

let pool;

function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('Falta la variable de entorno DATABASE_URL');
    // pg ya trata sslmode=require como verify-full; se declara explícito para evitar la advertencia.
    const connectionString = url.replace(/sslmode=(require|prefer|verify-ca)\b/, 'sslmode=verify-full');
    pool = new pg.Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
    });
    // Neon cierra las conexiones inactivas al suspender la base; sin este handler el proceso se caería.
    pool.on('error', (err) => console.warn('Conexión inactiva cerrada por la base:', err.message));
  }
  return pool;
}

// Fallos de red o conexiones cerradas por Neon: se pueden reintentar con una conexión nueva.
const DE_CONEXION = /Connection terminated|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EPIPE|timeout exceeded when trying to connect/i;
function esDeConexion(err) {
  if (!err) return false;
  if (DE_CONEXION.test(`${err.code || ''} ${err.message || ''}`)) return true;
  return Array.isArray(err.errors) && err.errors.some(esDeConexion);
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export async function q(text, params) {
  try {
    return (await getPool().query(text, params)).rows;
  } catch (err) {
    if (!esDeConexion(err)) throw err;
    await espera(300);
    return (await getPool().query(text, params)).rows;
  }
}

// Abre una conexión con la transacción iniciada; reintenta una vez si la conexión falla.
async function abrirTransaccion() {
  for (let intento = 0; ; intento++) {
    let client;
    try {
      client = await getPool().connect();
      await client.query('begin');
      return client;
    } catch (err) {
      if (client) client.release(err);
      if (intento >= 1 || !esDeConexion(err)) throw err;
      await espera(300);
    }
  }
}

// Ejecuta fn dentro de una transacción. fn recibe su propia función q.
export async function tx(fn) {
  const client = await abrirTransaccion();
  let fallo;
  try {
    const result = await fn(async (text, params) => (await client.query(text, params)).rows);
    await client.query('commit');
    return result;
  } catch (err) {
    fallo = err;
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    // Si la conexión quedó dañada, se descarta en lugar de devolverla al pool.
    client.release(esDeConexion(fallo) ? fallo : undefined);
  }
}
