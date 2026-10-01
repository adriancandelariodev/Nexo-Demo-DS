# Nexo · IA con n8n

Cuatro flujos de n8n conectan Nexo con Google Calendar, Google Meet y Claude:

| Flujo | Cuándo corre | Qué hace | Dónde se ve en Nexo |
|---|---|---|---|
| `01-resumen-de-sesiones.json` | Lun–vie, cada 30 min de 8:00 a 20:30 | Busca reuniones terminadas con transcripción de Meet, la IA saca resumen, acuerdos, compromisos y observaciones por persona, y el código mide cuánto habló cada quien | **Sesiones** (líder, sublíder y cada colaborador ve las suyas) |
| `02-asistente.json` | Cuando la líder pregunta | Agente de IA que consulta la base de datos en solo lectura y responde | **Asistente IA** (solo líder) |
| `03-reporte-semanal.json` | Viernes 17:00 | Métricas de la semana + una observación de la IA por persona → Google Sheets y Excel por correo | Correo de la líder y hoja de Google Sheets |
| `04-detector-de-riesgos.json` | Lun–vie 9:00 | Actividades vencidas, días sin registro, bloqueos largos y compromisos vencidos → una alerta por persona | Panel **Alertas del día** en Asistente IA |

```
Google Calendar ─┐
Google Drive ────┤          ┌─ vistas ia_* (solo lectura)
(transcripciones)├─► n8n ───┤
Claude ──────────┘          └─ funciones nexo_guardar_* ─► tablas sesiones, participaciones,
                                                         compromisos, alertas_ia
Nexo (Vercel) ── /api/asistente ──► webhook de n8n ──► respuesta
Nexo (Vercel) ── /api/sesiones ───► Postgres (Neon)
```

n8n nunca escribe directo en las tablas de Nexo: lee vistas `ia_*` y guarda solo a través de dos funciones de Postgres. El asistente usa otro usuario que solo puede leer.

## Qué se agregó al proyecto

| Archivo | Para qué |
|---|---|
| `backend/db/ia.sql` | Tablas `sesiones`, `participaciones`, `compromisos`, `alertas_ia`; vistas `ia_*`; funciones `nexo_guardar_sesion` y `nexo_guardar_alertas`. `npm run db:setup` ya lo ejecuta. |
| `backend/db/n8n-acceso.sql` | Crea los usuarios de base de datos `nexo_lector` y `nexo_n8n`. Se corre una vez a mano en Neon. |
| `backend/api/sesiones.js` | Devuelve sesiones, compromisos, métricas y alertas según el rol. |
| `backend/api/asistente.js` | Reenvía la pregunta de la líder al webhook de n8n con un secreto compartido. |
| `frontend/src/lib/vistas/Asistente.svelte` | Chat con la IA + alertas del día. |
| `frontend/src/lib/vistas/Sesiones.svelte` | Lista de reuniones, detalle, compromisos y métricas de comunicación. |
| `frontend/src/styles/12-ia.css` | Estilos de las dos vistas nuevas. |
| `n8n/*.json` | Los cuatro flujos para importar en n8n. |

---

## Paso a paso

Hazlo en este orden. Cada paso se puede probar antes de seguir.

### 0. Lo que necesitas

- Cuenta de **n8n Cloud** (https://n8n.io).
- Llave de API de **Anthropic** (https://console.anthropic.com → API Keys).
- **Google Workspace** con transcripciones de Meet activadas (ya las tienen).
- Una cuenta de Google que esté invitada a las reuniones que quieres analizar. Lo más simple es usar la cuenta de la líder, o crear una cuenta tipo `nexo@tuempresa.mx` e invitarla a las reuniones del equipo.

### 1. Base de datos (Neon)

1. En tu computadora, con `backend/.env` apuntando a Neon:
   ```powershell
   npm run --prefix backend db:setup
   ```
   Debe decir `✔ Tablas, vistas y funciones de IA creadas`. No borra nada: solo agrega lo nuevo.
2. Abre `backend/db/n8n-acceso.sql`, **cambia las dos contraseñas** (20+ caracteres aleatorios) y ejecútalo completo en **Neon → SQL Editor**.
3. Guarda las dos contraseñas; las vas a pegar en n8n.

Si alguien aparece en Meet con un nombre distinto al de Nexo (por ejemplo "Ana Sofía Ríos" contra "Ana Ríos"), Nexo intenta emparejarlos por primer nombre y apellido. Si no lo logra, ponle su nombre de Meet:
```sql
update usuarios set nombre_meet = 'Ana Sofía Ríos' where email = 'ana.rios@tuempresa.mx';
```

### 2. Backend (Vercel)

1. Genera un secreto:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. En el proyecto **backend** de Vercel → Settings → Environment Variables agrega:
   - `N8N_SECRET` = el secreto que generaste
   - `N8N_ASISTENTE_URL` = lo llenas en el paso 5
3. Sube los cambios a GitHub (o `vercel --prod`) para desplegar backend y frontend.

En local, pon las mismas dos variables en `backend/.env`.

### 3. n8n Cloud: zona horaria y credenciales

1. **Settings → zona horaria**: `America/Mexico_City` (los flujos ya la traen, pero así todo coincide).
2. **Credentials → Add credential**, crea estas siete:

| Nombre sugerido | Tipo | Datos |
|---|---|---|
| Nexo · n8n | Postgres | Host, Database y Port del connection string de Neon · User `nexo_n8n` · su contraseña · SSL **Require** |
| Nexo · lector | Postgres | Igual, pero User `nexo_lector` |
| Anthropic | Anthropic | Tu API key |
| Google Calendar | Google Calendar OAuth2 API | *Sign in with Google* con la cuenta del paso 0 |
| Google Drive | Google Drive OAuth2 API | Misma cuenta |
| Google Sheets | Google Sheets OAuth2 API | Misma cuenta |
| Gmail | Gmail OAuth2 | La cuenta desde la que sale el reporte |
| Nexo · secreto | Header Auth | Name: `X-Nexo-Secret` · Value: el mismo `N8N_SECRET` |

El host de Neon es la parte entre `@` y `/` del connection string (ej. `ep-xxx.us-east-2.aws.neon.tech`). La base suele ser `neondb`, puerto `5432`.

### 4. Importar los flujos

Para cada archivo de esta carpeta:

1. **Overview → Create workflow**.
2. Menú `⋯` arriba a la derecha → **Import from File** → elige el `.json`.
3. Abre cada nodo con un triángulo de advertencia y elige su credencial:
   - Nodos Postgres del asistente (`consultar_nexo`) → **Nexo · lector**
   - Todos los demás nodos Postgres → **Nexo · n8n**
   - Nodos **Claude** → **Anthropic**. En *Model* elige el modelo Sonnet más reciente de la lista.
   - Nodos HTTP de Google: *Eventos del calendario* → Google Calendar; *Descargar transcripción* → Google Drive.
4. **Save**.

Ajustes por flujo:

- **01 · Resumen de sesiones** → nodo *Configuración*: en `calendario` deja `primary` (el calendario de la cuenta conectada) o pon el correo de otro calendario compartido con esa cuenta.
- **03 · Reporte semanal** → crea un Google Sheet con una hoja llamada `Semanal` y en la fila 1 pega estos encabezados, uno por columna:
  `Semana del | Colaborador | Días con registro | Cerradas | Abiertas | Vencidas | Bloqueos abiertos | Sesiones | % voz promedio | Actualizaciones completas | Compromisos cumplidos | Observación IA`
  Luego en el nodo *Agregar a Google Sheets* pega la URL del documento. En *Enviar a la líder* cambia el correo.

### 5. Probar y activar (en este orden)

**a) Detector de riesgos** (el más sencillo)
1. Abre el flujo → **Execute workflow**.
2. Todos los nodos deben quedar en verde. En Nexo, entra como líder → **Asistente IA** → deben aparecer las *Alertas del día*.
3. Activa el flujo (switch **Active** arriba).

**b) Resumen de sesiones**
1. Haz una reunión de prueba de 5 minutos en Meet con la transcripción activada, invitando a la cuenta conectada. Habla un poco: "voy en 60% con X, el viernes termino Y, estoy bloqueado por Z".
2. Espera a que llegue el correo de Google con la transcripción (unos minutos después de colgar).
3. Ejecuta el flujo a mano. En *Reuniones con transcripción* debe salir tu reunión; al final *Guardar en Nexo* devuelve un `sesion_id`.
4. En Nexo → **Sesiones** revisa el resumen y la participación. Activa el flujo.

**c) Asistente**
1. Activa el flujo (el webhook de producción solo responde con el flujo activo).
2. Abre el nodo *Webhook de Nexo* → pestaña **Production URL** → cópiala.
3. Pégala en Vercel como `N8N_ASISTENTE_URL` y vuelve a desplegar el backend.
4. En Nexo → **Asistente IA** pregunta "¿Quién tiene más riesgo esta semana?".

**d) Reporte semanal**
1. Ejecútalo a mano un día cualquiera: debe agregar filas a la hoja y mandarte el correo con el Excel.
2. Actívalo.

---

## Qué mide la IA y qué mide el código

| Dato | Quién lo calcula | Cómo |
|---|---|---|
| % de voz, palabras, intervenciones | Código (nodo *Medir participación*) | Cuenta las palabras de cada hablante en la transcripción |
| Resumen, acuerdos, cita | IA | Solo con lo que está en la transcripción |
| Compromisos y fechas | IA | Convierte "el viernes" a fecha real según el día de la reunión |
| Compromisos cumplidos | IA | Marca los de reuniones anteriores que se reportaron como terminados |
| Actualización completa | IA | Sí = estatus + dato concreto + siguiente paso |
| Comunicó bloqueo | IA | Solo impedimentos de su propio trabajo |

Las instrucciones de la IA le prohíben juzgar personalidad, tono, acento o capacidad, y le piden tratar la poca participación como un hecho, no como un defecto.

## Reglas para el equipo (antes de activar)

- Avisa al equipo, por escrito, que las reuniones se transcriben y para qué se usa. Validen el aviso de privacidad con RH.
- Cada colaborador ve sus propias sesiones y métricas en **Mis sesiones**: lo mismo que ve la líder sobre él.
- La IA sugiere; la evaluación la hace la líder.

## Consumo en n8n Cloud

Los planes de n8n Cloud cuentan ejecuciones al mes. Con estos horarios:
- Resumen de sesiones: 26 al día × ~22 días ≈ 570
- Detector: ~22 · Reporte: ~4 · Asistente: una por pregunta

Si necesitas menos, cambia el horario del resumen a cada hora (`0 8-20 * * 1-5`).

## Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| *Reuniones con transcripción* no devuelve nada | La reunión no terminó hace 10+ min, no tenía transcripción, o la cuenta no está invitada | Revisa en Calendar que el evento tenga el Doc "Transcripción" adjunto |
| *Descargar transcripción* da 403/404 | La cuenta conectada no tiene acceso al Doc | Invita a esa cuenta a la reunión, o que el organizador comparta su carpeta *Meet Recordings* con ella |
| "La IA no devolvió JSON" | Respuesta cortada o con texto extra | Vuelve a ejecutar; si se repite con reuniones muy largas, sube *Maximum Number of Tokens* en el nodo Claude |
| Alguien sale como externo en Sesiones | Su nombre en Meet no coincide con Nexo | Llena `usuarios.nombre_meet` (paso 1) |
| Nexo dice "El asistente no pudo responder" | El flujo está inactivo, la URL es la de *Test*, o el secreto no coincide | Revisa las ejecuciones del flujo en n8n y las variables de Vercel |
| Nexo dice "La IA tardó demasiado" | Pregunta muy amplia | Pregunta por una persona, proyecto o semana concreta |
| Error de conexión a Postgres | SSL desactivado o host con `-pooler` | Usa SSL *Require*; prueba con el host sin `-pooler` |
