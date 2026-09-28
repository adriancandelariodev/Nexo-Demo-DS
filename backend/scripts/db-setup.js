// Crea las tablas y, con --demo, carga los datos de ejemplo.
// Uso: npm run db:setup   ·   npm run db:demo
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
import fs from 'node:fs/promises';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('Falta DATABASE_URL en el archivo .env');
  process.exit(1);
}

const leer = (f) => fs.readFile(new URL(`../db/${f}`, import.meta.url), 'utf8');
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query(await leer('schema.sql'));
  console.log('✔ Tablas creadas');
  if (process.argv.includes('--demo')) {
    await client.query(await leer('seed.sql'));
    console.log('✔ Datos de ejemplo cargados (contraseña de todas las cuentas: Nexo2026)');
  }
} finally {
  await client.end();
}
