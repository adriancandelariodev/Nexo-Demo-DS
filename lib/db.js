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
    pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });
  }
  return pool;
}

export async function q(text, params) {
  const { rows } = await getPool().query(text, params);
  return rows;
}

// Ejecuta fn dentro de una transacción. fn recibe su propia función q.
export async function tx(fn) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await fn(async (text, params) => (await client.query(text, params)).rows);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
