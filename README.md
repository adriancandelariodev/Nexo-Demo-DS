# Nexo · Desarrollo de Software

Aplicación web para dar seguimiento a las actividades del equipo de desarrollo. Está basada en la demo `nexo-desarrollo.html`.

- **Líder:** panel general con KPIs, alertas automáticas, avance por proyecto, tablero, bloqueos, revisión de actividades completadas, vista por persona y administración de proyectos y cuentas.
- **Sublíder:** registra sus propias actividades como un colaborador y, además, supervisa a los colaboradores que la líder le asigna. Ve su panel, tableros y bloqueos, y puede aprobar, devolver y pedir actualizaciones. No entra a Administración. Sus propias actividades las revisa la líder.
- **Colaborador:** registra y edita sus actividades, reporta y resuelve bloqueos, agrega entregables (Drive, Excel, Miro) y ve los avisos de su líder o sublíder.

## Stack

| Parte | Tecnología |
|---|---|
| Frontend | HTML + CSS + JavaScript sin framework (`public/`) |
| API | Funciones serverless de Vercel en Node.js (`api/`) |
| Base de datos | PostgreSQL (Neon, conectado desde Vercel) |
| Sesión | Cookie `HttpOnly` con JWT firmado (`jose`), contraseñas con bcrypt |

Los permisos se validan en el servidor: un colaborador solo recibe y modifica sus propios datos, aunque llame a la API directamente.

```
api/            auth · estado · actividades · bloqueos · revision · recordatorios · admin
lib/            conexión a BD, sesión, validaciones y fechas
db/schema.sql   tablas
db/seed.sql     datos de ejemplo (los de la demo)
public/         index.html · styles.css · app.js
scripts/        servidor local y utilidades de BD
```

---

## Desplegar en Vercel (sin instalar nada)

### 1. Sube el código a GitHub
1. Crea una cuenta en <https://github.com> si no tienes una.
2. Crea un repositorio nuevo (privado), por ejemplo `nexo`.
3. En el repositorio vacío, entra a **"uploading an existing file"**. Arrastra **todo el contenido** de esta carpeta (`api`, `lib`, `db`, `public`, `scripts`, `package.json`, `vercel.json`, `.gitignore`, `.env.example`, `README.md`) y confirma con **Commit changes**.
   - No subas ningún archivo `.env` con contraseñas reales.

### 2. Crea el proyecto en Vercel
1. Entra a <https://vercel.com> con tu cuenta de GitHub.
2. **Add New… → Project** → importa el repositorio `nexo`.
3. En *Framework Preset* deja **Other**. No cambies nada más y pulsa **Deploy**. El primer deploy sale bien, pero la app todavía no tiene base de datos.

### 3. Crea la base de datos (Neon)
1. En tu proyecto de Vercel: pestaña **Storage → Create Database → Neon (Serverless Postgres)**.
2. Elige la región más cercana (por ejemplo `us-east-1`) y conéctala al proyecto. Vercel agrega sola la variable `DATABASE_URL`.

### 4. Agrega la llave de sesión
En **Settings → Environment Variables** agrega:

| Variable | Valor |
|---|---|
| `AUTH_SECRET` | Una cadena aleatoria de 32 caracteres o más (ver abajo) |
| `EMAIL_DOMAIN` | *(opcional)* dominio permitido para iniciar sesión, por ejemplo `tuempresa.mx` |

Para generar `AUTH_SECRET` en Windows, abre PowerShell y ejecuta:

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

### 5. Crea las tablas
1. En Vercel: **Storage →** tu base de datos **→ Open in Neon**.
2. En Neon abre el **SQL Editor**.
3. Copia el contenido de `db/schema.sql`, pégalo y pulsa **Run**.
4. Después haz **una** de estas dos cosas:
   - **Probar con los datos de la demo:** pega `db/seed.sql` y pulsa **Run**. Todas las cuentas usan la contraseña `Nexo2026` (líder: `jaz@tuempresa.mx`, colaboradores: `ana.rios@tuempresa.mx`, `bruno.salas@tuempresa.mx`, etc.). Si defines `EMAIL_DOMAIN`, ponle `tuempresa.mx` mientras pruebas.
   - **Empezar limpio:** crea solo tu cuenta de líder (cambia nombre, correo y contraseña):
     ```sql
     insert into usuarios (nombre, email, rol, password_hash)
     values ('Tu Nombre', 'tu.correo@tuempresa.mx', 'lider', crypt('UnaContraseñaSegura', gen_salt('bf', 10)));
     ```
     Después, desde **Administración** en la app, creas las cuentas del equipo y los proyectos.

### 6. Vuelve a desplegar
En Vercel: **Deployments →** el último deploy **→ ⋯ → Redeploy**, para que tome las variables nuevas. Abre la URL (`https://nexo-xxxx.vercel.app`) e inicia sesión.

---

## Correr en tu computadora (opcional)

Requiere Node.js 20 o superior y Git:

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

Luego, en esta carpeta:

```powershell
npm install
copy .env.example .env      # y edita .env con tu DATABASE_URL de Neon y un AUTH_SECRET
npm run db:setup            # crea las tablas   (o: npm run db:demo  para incluir los datos de ejemplo)
npm run dev                 # http://localhost:3000
```

Otros comandos:

- `npm run crear-lider -- "Nombre" correo@empresa.mx "contraseña"`: crea una cuenta de líder o restablece su contraseña.
- Con Vercel CLI (`npm i -g vercel`): `vercel link`, `vercel env pull .env` para traer las variables y `vercel --prod` para desplegar desde la terminal.

## Reglas de negocio

- **Avance del proyecto** = actividades completadas ÷ actividades totales.
- **Estatus del proyecto** = *Bloqueado* si alguna actividad está bloqueada, *Completado* si todas lo están, *En progreso* si alguna ya empezó y *Por hacer* en otro caso.
- Cada vez que un colaborador guarda una actividad se registra un **avance del día**. Con eso se calculan los "días con registro" y el feed de últimos avances.
- Al llegar a 100% la actividad pasa a **Completado** y queda **pendiente de revisión** del líder, que puede aprobarla o devolverla. Si la devuelve, regresa a *En progreso* con 90% y el colaborador recibe un aviso.
- **Alertas automáticas** (se calculan al abrir el panel):
  - Crítico: bloqueo abierto 5 días o más, bloqueo junto con una actividad vencida, o compromiso del proyecto ya vencido.
  - Atención: cualquier bloqueo abierto, actividades vencidas, compromiso en 3 días o menos, o un colaborador con actividades abiertas que lleva 2 días hábiles sin registrar avance.

## Pendientes para una siguiente versión

- Inicio de sesión con Google Workspace. El botón de la demo se quitó hasta configurarlo.
- Recuperación de contraseña por correo. Por ahora el líder la restablece desde Administración.
- Aviso diario a Google Chat con las alertas (Vercel Cron + webhook).
- Límite de intentos de inicio de sesión.
