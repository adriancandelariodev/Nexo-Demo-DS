# Nexo · Desarrollo de Software

Aplicación web para dar seguimiento a las actividades del equipo de desarrollo. Está basada en la demo `nexo-desarrollo.html`.

- **Líder:** panel general con KPIs, alertas automáticas, avance por proyecto, tablero, bloqueos, revisión de actividades completadas, vista por persona y administración de proyectos y cuentas.
- **Sublíder:** registra sus propias actividades como un colaborador y, además, supervisa a los colaboradores que la líder le asigna. Ve su panel, tableros y bloqueos, y puede aprobar, devolver y pedir actualizaciones. No entra a Administración. Sus propias actividades las revisa la líder.
- **Colaborador:** registra y edita sus actividades, reporta y resuelve bloqueos, agrega entregables (Drive, Excel, Miro) y ve los avisos de su líder o sublíder.

## Estructura: frontend y backend separados

```
frontend/                 → la pantalla (se despliega como un proyecto de Vercel)
  public/                   index.html · styles.css · app.js
  vercel.json               reenvía /api/* al backend
  servidor-local.js         servidor de desarrollo (puerto 3000)

backend/                  → la API y la base de datos (otro proyecto de Vercel)
  api/                      auth · estado · actividades · bloqueos · revision · recordatorios · admin
  lib/                      conexión a BD, sesión, permisos, validaciones y fechas
  db/schema.sql             tablas
  db/seed.sql               datos de ejemplo
  scripts/                  servidor de desarrollo (puerto 3001) y utilidades de BD
  public/index.html         página informativa de la API
  .env                      variables locales (no se sube a GitHub)

dev.js                    → levanta los dos en tu computadora con un solo comando
```

| Parte | Tecnología |
|---|---|
| Frontend | HTML + CSS + JavaScript sin framework |
| Backend | Funciones serverless de Vercel en Node.js |
| Base de datos | PostgreSQL (Neon) |
| Sesión | Cookie `HttpOnly` con JWT firmado (`jose`), contraseñas con bcrypt |

**Cómo se comunican:** el frontend siempre llama a `/api/...` en su propio dominio. En Vercel, la regla `rewrites` de `frontend/vercel.json` reenvía esas llamadas al backend; en local lo hace `servidor-local.js`. Para el navegador es un solo sitio, así que la cookie de sesión funciona sin configurar CORS.

Los permisos se validan en el backend: un colaborador solo recibe y modifica sus propios datos, aunque llame a la API directamente.

---

## Correr en tu computadora

Requiere Node.js 20 o superior (`winget install OpenJS.NodeJS.LTS`).

```powershell
npm run instalar                         # instala las dependencias del backend
copy backend\.env.example backend\.env   # y edita DATABASE_URL (Neon) y AUTH_SECRET
npm run --prefix backend db:setup        # crea las tablas  (db:demo para incluir datos de ejemplo)
npm run dev                              # frontend http://localhost:3000 · backend http://localhost:3001
```

Abre **http://localhost:3000**. `Ctrl + C` detiene los dos servidores.

Otros comandos del backend (ejecutar dentro de `backend/`):

- `npm run crear-lider -- "Nombre" correo@empresa.mx "contraseña"`: crea una cuenta de líder o restablece su contraseña.

---

## Desplegar en Vercel: dos proyectos desde el mismo repositorio

### Backend (API)
1. **Add New… → Project** → importa el repositorio.
2. **Project Name:** `nexo-demo-ds-api`. Si usas otro nombre, cambia la dirección en `frontend/vercel.json`.
3. **Root Directory:** `backend`. *Framework Preset:* **Other**.
4. **Environment Variables:** agrega `AUTH_SECRET` (y opcionalmente `EMAIL_DOMAIN`) → **Deploy**.
5. En el proyecto: **Storage →** tu base Neon **→ Connect Project**. Deja el prefijo vacío para que se cree `DATABASE_URL` y desmarca "Create Database Branch". Luego haz **Redeploy**.
6. Comprueba que `https://nexo-demo-ds-api.vercel.app/api/auth` responda `{"usuario":null}`.

### Frontend (pantalla)
1. En el proyecto del frontend: **Settings → Build and Deployment → Root Directory:** `frontend` → **Save**.
2. Este proyecto no necesita variables ni base de datos. Puedes desconectar Neon y quitar `DATABASE_URL` y `AUTH_SECRET`.
3. **Redeploy** y abre su dirección. Todo funciona igual que antes.

Para generar `AUTH_SECRET` en Windows (PowerShell):

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

### Base de datos desde cero
En Neon → **SQL Editor**, ejecuta `backend/db/schema.sql`. Después:
- **Datos de la demo:** ejecuta `backend/db/seed.sql`. Todas las cuentas usan la contraseña `Nexo2026` (líder `jaz@tuempresa.mx`, sublíder `fernando.gil@tuempresa.mx`, colaboradores `ana.rios@tuempresa.mx`, etc.).
- **Empezar limpio:** crea solo tu cuenta de líder:
  ```sql
  insert into usuarios (nombre, email, rol, password_hash)
  values ('Tu Nombre', 'tu.correo@tuempresa.mx', 'lider', crypt('UnaContraseñaSegura', gen_salt('bf', 10)));
  ```

---

## Reglas de negocio

- **Avance del proyecto** = actividades completadas ÷ actividades totales.
- **Estatus del proyecto** = *Bloqueado* si alguna actividad está bloqueada, *Completado* si todas lo están, *En progreso* si alguna ya empezó y *Por hacer* en otro caso.
- Cada vez que alguien guarda una actividad se registra un **avance del día**. Con eso se calculan los "días con registro" (lunes a viernes) y el feed de últimos avances.
- Al llegar a 100% la actividad pasa a **Completado** y queda **pendiente de revisión** de la líder o del sublíder de esa persona. Si la devuelven, regresa a *En progreso* con 90% y la persona recibe el motivo.
- **Alertas automáticas** (se calculan al abrir el panel):
  - Crítico: bloqueo abierto 5 días o más, bloqueo junto con una actividad vencida, o compromiso del proyecto ya vencido.
  - Atención: cualquier bloqueo abierto, actividades vencidas, compromiso en 3 días o menos, o una persona con actividades abiertas que lleva 2 días hábiles sin registrar avance.

## Pendientes para una siguiente versión

- Inicio de sesión con Google Workspace.
- Recuperación de contraseña por correo. Por ahora la líder la restablece desde Administración.
- Aviso diario a Google Chat con las alertas (Vercel Cron + webhook).
- Límite de intentos de inicio de sesión.
