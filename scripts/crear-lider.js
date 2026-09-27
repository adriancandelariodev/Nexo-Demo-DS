// Crea (o restablece) una cuenta de líder.
// Uso: npm run crear-lider -- "Nombre" correo@empresa.mx "contraseña-de-8-o-más"
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const [nombre, correo, password] = process.argv.slice(2);
if (!nombre || !correo || !password || password.length < 8) {
  console.error('Uso: npm run crear-lider -- "Nombre" correo@empresa.mx "contraseña-de-8-o-más"');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
await client.connect();
try {
  await client.query(
    `insert into usuarios (nombre, email, rol, password_hash) values ($1, $2, 'lider', $3)
     on conflict (email) do update set nombre = excluded.nombre, rol = 'lider',
                                       password_hash = excluded.password_hash, activo = true`,
    [nombre, correo.trim().toLowerCase(), await bcrypt.hash(password, 10)]
  );
  console.log(`✔ Cuenta de líder lista: ${correo}`);
} finally {
  await client.end();
}
