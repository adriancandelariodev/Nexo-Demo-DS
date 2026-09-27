import bcrypt from 'bcryptjs';
import { handler, falla } from '../lib/http.js';
import { q, tx } from '../lib/db.js';
import { str, fecha, ids, validarEnlaces, validarDominio } from '../lib/validar.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Altas y cambios de cuentas y proyectos (solo líder)
export default handler(
  ['POST'],
  async ({ user, body }) => {
    switch (body.accion) {
      case 'crear_usuario': {
        const nombre = str(body.nombre, 120);
        const email = str(body.email, 200).toLowerCase();
        const rol = body.rol === 'lider' ? 'lider' : 'dev';
        const password = String(body.password || '');
        if (!nombre || !EMAIL.test(email)) falla(400, 'Escribe un nombre y un correo válido.');
        validarDominio(email);
        if (password.length < 8) falla(400, 'La contraseña debe tener al menos 8 caracteres.');
        const [dup] = await q('select 1 from usuarios where email = $1', [email]);
        if (dup) falla(409, 'Ya existe una cuenta con ese correo.');
        await q('insert into usuarios (nombre, email, rol, password_hash) values ($1, $2, $3, $4)', [
          nombre,
          email,
          rol,
          await bcrypt.hash(password, 10),
        ]);
        return { ok: true };
      }

      case 'actualizar_usuario': {
        const id = Number(body.id);
        const nombre = str(body.nombre, 120);
        const rol = body.rol === 'lider' ? 'lider' : 'dev';
        const activo = body.activo !== false;
        const password = String(body.password || '');
        if (!nombre) falla(400, 'Escribe el nombre.');
        if (id === user.id && (!activo || rol !== 'lider')) {
          falla(400, 'No puedes desactivar tu propia cuenta ni quitarte el rol de líder.');
        }
        if (password && password.length < 8) falla(400, 'La contraseña debe tener al menos 8 caracteres.');
        const params = [id, nombre, rol, activo];
        if (password) params.push(await bcrypt.hash(password, 10));
        const r = await q(
          `update usuarios set nombre = $2, rol = $3, activo = $4${password ? ', password_hash = $5' : ''}
            where id = $1 returning id`,
          params
        );
        if (!r.length) falla(404, 'No encontramos esa cuenta.');
        return { ok: true };
      }

      case 'guardar_proyecto': {
        const cliente = str(body.cliente, 120);
        const nombre = str(body.nombre, 200);
        if (!cliente || !nombre) falla(400, 'Escribe el cliente y el nombre del proyecto.');
        const responsable = body.responsable_id ? Number(body.responsable_id) : null;
        const inicio = fecha(body.fecha_inicio);
        const compromiso = fecha(body.fecha_compromiso);
        if (inicio && compromiso && compromiso < inicio) falla(400, 'La fecha compromiso no puede ser anterior al inicio.');
        const miembros = ids(body.miembros);
        const enlaces = validarEnlaces(body.enlaces);
        const eliminar = ids(body.enlaces_eliminar);

        return tx(async (tq) => {
          const [c] = await tq(
            `insert into clientes (nombre) values ($1)
             on conflict (nombre) do update set nombre = excluded.nombre returning id`,
            [cliente]
          );
          let id = body.id ? Number(body.id) : null;
          if (id) {
            const r = await tq(
              `update proyectos set cliente_id = $2, nombre = $3, responsable_id = $4, fecha_inicio = $5, fecha_compromiso = $6
                where id = $1 returning id`,
              [id, c.id, nombre, responsable, inicio, compromiso]
            );
            if (!r.length) falla(404, 'No encontramos ese proyecto.');
          } else {
            const [p] = await tq(
              `insert into proyectos (cliente_id, nombre, responsable_id, fecha_inicio, fecha_compromiso)
               values ($1, $2, $3, $4, $5) returning id`,
              [c.id, nombre, responsable, inicio, compromiso]
            );
            id = p.id;
          }
          await tq(`delete from proyecto_miembros where proyecto_id = $1 and not (usuario_id = any($2::int[]))`, [id, miembros]);
          await tq(
            `insert into proyecto_miembros (proyecto_id, usuario_id)
             select $1, u.id from usuarios u where u.id = any($2::int[]) and u.rol = 'dev'
             on conflict do nothing`,
            [id, miembros]
          );
          if (eliminar.length) {
            await tq(`delete from enlaces where proyecto_id = $1 and id = any($2::int[])`, [id, eliminar]);
          }
          for (const l of enlaces) {
            await tq(`insert into enlaces (tipo, url, proyecto_id, creado_por) values ($1, $2, $3, $4)`, [l.tipo, l.url, id, user.id]);
          }
          return { id };
        });
      }

      case 'archivar_proyecto': {
        const r = await q(`update proyectos set archivado = $2 where id = $1 returning id`, [
          Number(body.id),
          body.archivado !== false,
        ]);
        if (!r.length) falla(404, 'No encontramos ese proyecto.');
        return { ok: true };
      }

      default:
        falla(400, 'Acción no válida.');
    }
  },
  { rol: 'lider' }
);
