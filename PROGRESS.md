# PROGRESS.md — ConexAgro · Módulo de gestión de proyectos

Última actualización: 2026-11-17 (sesión 9)

## Sesión 9 — resumen (leer primero)
Se entregó la **interfaz de proyectos del productor** sobre la API ya probada.
- **Verificación**: `npm test` → **72/72** (69 + 2 de `parseProject`/formato + 1 de nombre de archivo); `next build` OK; **E2E en Chromium ampliado** (`bash scripts/e2e/run.sh`; **recompilar con `npm run build` antes**, el script usa `next start`): el productor ve «Mis proyectos», el formulario vacío muestra errores por campo, publica «Ñame orgánico», adjunta un PDF (descarga byte a byte idéntica), un archivo que no es PDF se rechaza, elimina el documento, cierra el proyecto con confirmación y un inversionista ya no lo ve (404) ni accede a `/proyectos`. **axe: 0 violaciones** en `/`, `/login`, `/registro`, `/proyectos`, `/proyectos/nuevo`, `/proyectos/[id]`, `/solicitudes` (móvil 375 px, sin scroll horizontal). `/verificar-correo` sigue sin auditar con axe.
- **Archivos nuevos**: `app/proyectos/page.js` (lista `GET /projects/mine`), `app/proyectos/nuevo/page.js`, `app/proyectos/[id]/page.js` (detalle, PDF de soporte, cierre). **Modificados**: `src/ui/session.js` (`apiFetch` acepta `raw`/`headers`/`blob`), `src/ui/format.js` (`parseProject`, `cop`, `MAX_PDF_BYTES`), `Nav.js` («Mis proyectos» solo para PRODUCTOR), encabezados de tarjetas a `h2`.
- **Corregido (hallazgo del E2E)**: el nombre del PDF se guardaba como `Plan20econC3B3mico.pdf` con tildes. Ahora la UI envía `x-filename` con `encodeURIComponent`, la ruta lo decodifica y `sanitizeFilename` normaliza acentos (`Plan económico ñandú.pdf` → `Plan economico nandu.pdf`).
- **Límites conocidos**: **no hay edición de proyectos en la UI** (la API `PATCH /projects/:id` existe); el administrador ve «Mis proyectos» solo por URL; no hay listado/búsqueda de proyectos activos para otros roles (solo el selector de «Enviar solicitud»); la confirmación de cierre es en línea (`role="alertdialog"`), no un modal; 5 MB del PDF es suposición.

## Sesión 8 — resumen
Se entregó la **interfaz web mínima**: `/registro`, `/verificar-correo` (el enlace del correo ya no da 404), `/login` y `/solicitudes` (bandeja + envío), con la paleta, Times New Roman y navegación accesible.
- **Verificación**: `npm test` → **69/69** (65 + 4 de `test/ui.test.js`, 2 ejecuciones); `next build` OK (rutas estáticas `/`, `/login`, `/registro`, `/solicitudes`, `/verificar-correo`). **E2E en Chromium** (`bash scripts/e2e/run.sh`, ver cabecera del script): registro → login sin verificar (ofrece reenviar) → enlace de verificación (y reutilizado → «ya fue utilizado») → `/solicitudes` sin sesión redirige a login → envío de solicitud, duplicada 409 con mensaje → el productor contrapropone (validación de campo) → el inversionista acepta → cierre de sesión en una pestaña cierra la otra → sesión inactiva >30 min se descarta. **axe: 0 violaciones** en `/`, `/login`, `/registro`; sin scroll horizontal a 320 px. `/solicitudes` y `/verificar-correo` se recorrieron en el E2E pero **no se auditaron con axe**.
- **Archivos nuevos**: `app/{registro,login,verificar-correo,solicitudes}/page.js`, `app/components/{Nav,Field}.js`, `src/ui/{session,format}.js`, `test/ui.test.js`, `scripts/e2e/`. Modificados: `app/layout.js` (skip link, nav), `app/page.js`, `app/globals.css`.
- **Decisión tomada (RI-09, pendiente de confirmar)**: tokens en `localStorage` (el ERS admite «secure localStorage») para cerrar sesión en todas las pestañas (evento `storage`). Riesgo: un XSS podría leerlos. Alternativa: cookies `httpOnly` (requiere cambiar `api.js`).
- **RN-09 (inactividad 30 min) ahora se aplica en el cliente** (se registra actividad y se cierra la sesión). **El servidor sigue sin aplicarla**: un token robado vale 1 h.
- El `apiFetch` renueva con el refresh token una vez al recibir 401.
- **Límites conocidos de la UI**: en «Enviar una solicitud» solo se listan proyectos **ajenos** y activos (para ofrecer un proyecto propio a otro usuario haría falta un buscador de usuarios); no hay interfaz de «Mis proyectos»/«Publicar proyecto» ni de terrenos; no hay recuperación de contraseña; el enlace del correo usa `localhost:3000` (configurar la URL base pública antes de desplegar); la interfaz de administración (RF-08/09) no existe.

## Sesión 7 — resumen
Se entregó el **módulo de solicitudes de vinculación (RF-07) sobre la BD**, con API y pruebas. PostgreSQL 16 se reinstaló con `apt-get install postgresql` + `pg_ctlcluster 16 main start` (rol de pruebas: `conexagro`/`conexagro`, superusuario).
- **Pruebas: `npm test` → 65/65** (3 ejecuciones seguidas estables): 52 previas + 13 nuevas en `test/requests.test.js`. `db/migrations` aplica sobre base vacía; `next build` OK (3 rutas nuevas); prueba con servidor real + `curl` (crear 201 → duplicada 409 → aceptar 200 → listar → sin token 401; 0 errores en el log).
- **Nuevo código**:
  - `db/migrations/003_solicitudes.sql`: `solicitudes` (FK a `usuarios`, `CHECK` de estados y de emisor ≠ receptor, `origen_id` para contrapropuestas) y `solicitud_historial` (estado, fecha/hora, responsable; RN-28). **Índice único parcial** que garantiza en la BD una sola solicitud `pendiente` por pareja (en cualquier sentido) y referencia (FA-01), también ante concurrencia.
  - `src/requests/repository.js`: SQL con `pg`; `tx(fn)` da un repositorio ligado a una transacción; `lock` usa `SELECT … FOR UPDATE`.
  - `src/requests/service.js`: usa `domain.js` (sesión 5) + BD. Respuesta y contrapropuesta en **una sola transacción** (RNF-05); probado con 6 envíos y 4 respuestas simultáneas (solo una gana, el resto 409).
  - Rutas: `POST|GET /api/v1/requests` (`?box=recibidas|enviadas`), `GET /api/v1/requests/:id` (con historial), `POST /api/v1/requests/:id/respond {accion, mensaje?, condiciones?}`.
  - `container.js` (`getRequestService`/`setRequestService`), `api.js` (`requests` en `route()`), `test/helpers.js` (`reqApi`, el servicio usa el reloj de pruebas), `test/db.test.js` (lista de migraciones esperada).
- **Reglas aplicadas**: administrador no envía, ve ni gestiona (403, RN-25); solo emisor/receptor ven una solicitud (404 para el resto, RN-27); solo el receptor responde (403); cerrada → 409 (RN-26); historial fechado (RN-28); destinatario debe existir, estar activo, con correo verificado y no ser administrador (400).
- **Suposiciones nuevas a confirmar con el docente** (el ERS no las fija):
  1. **Solo referencia `proyecto`**: no existe tabla de terrenos, así que `referenciaTipo: 'terreno'` responde 400. La migración ya admite `'terreno'` (sin FK, polimórfica).
  2. **Receptor según el proyecto**: sobre un proyecto ajeno, el destinatario es siempre su autor (se completa solo; otro → 400). El autor puede ofrecer su proyecto a cualquier usuario no administrador. Solo proyectos `activo` (cerrado → 404).
  3. Contrapropuesta (de la sesión 5): cierra la original (`contrapropuesta`) y crea una pendiente con emisor/receptor invertidos, enlazada por `origen_id`.
  4. El administrador recibe 403 también al **listar/consultar** solicitudes (RN-25 + RN-27). Si F-ADMIN-03 («supervisar el flujo de solicitudes») debe verlas, hay que definir una vista de supervisión aparte.
  5. «Notifica al receptor/emisor» (RF-07 pasos 3 y 6) se cumple solo con la **bandeja** (`GET /requests`); no hay correo ni tiempo real (fuera de alcance de la v1).
- **No hecho**: RN-21 (resumen de información financiera hasta que haya solicitud aceptada) no se aplicó a ningún endpoint; interfaz web; límites de la sesión 6 (inactividad, revocación, FK `autor_id`, rate limiting) siguen abiertos.

## Sesión 6 — resumen
**Esta vez el entorno tuvo red y se pudo instalar PostgreSQL 16** (`apt-get update && apt-get install postgresql`, arrancar con `pg_ctlcluster 16 main start`). Se cerró el bloqueo de las sesiones 4 y 5 y se entregó la **autenticación real de extremo a extremo (RF-01, RF-02)**.
- **Pruebas: `npm test` → 52/52** sobre PostgreSQL real (repetido 5 veces, estable): 23 de proyectos/BD + 8 de auth (JWT, bloqueo, validación) + 8 de dominio de solicitudes + 13 nuevas de flujo de auth (`test/authflow.test.js`).
- **Validado por primera vez**: `002_usuarios.sql` aplica bien sobre base vacía y sobre la suite; `npm ci`, `next build` (6 rutas nuevas) y prueba con servidor real + `curl` (registro → login rechazado sin verificar → verificación → login → crear proyecto con JWT 201; sin token y con cabeceras `x-user-*` 401; 5.º fallo → 423; 0 errores en el log).
- **Corregido**: `test/db.test.js` esperaba solo `001_proyectos.sql` (desactualizado por la migración 002); y un error intermitente del teardown de las pruebas («terminating connection…», visto una vez en `documents.test.js`): `pool.on('error')` en `test/helpers.js`.
- **Nuevo código**:
  - `src/auth/repository.js` (SQL con `pg`): alta con unicidad por BD → 409 por campo (RN-01/02), verificación de correo consumida en transacción (RN-03), conteo de fallos con `SELECT … FOR UPDATE` (atómico; probado con 8 logins simultáneos).
  - `src/auth/service.js`: `register`, `verifyEmail`, `resendVerification` (respuesta idéntica exista o no el correo), `login`, `refresh`, `me`, `createAdmin`. bcryptjs con ≥10 rondas (RN-10). Login: correo inexistente y clave mala dan la misma respuesta (con bcrypt «señuelo» para igualar tiempos); bloqueado → 423 sin evaluar la clave; inactivo/no verificado solo se revelan con la clave correcta.
  - `src/auth/mailer.js`: interfaz `sendVerification`; consola fuera de producción; en producción falla salvo `MAIL_TRANSPORT=console` (demo).
  - `src/db/pg.js`: `tx(fn)` (transacciones). `src/server/container.js`: un único pool compartido + `getAuthService`.
  - `src/http/api.js`: **`currentUser` ahora lee `Authorization: Bearer <JWT de acceso>`**. Las cabeceras `x-user-id/x-user-roles` quedan **solo** con `ALLOW_DEV_HEADERS=true` y fuera de producción (las pruebas de proyectos la activan en `test/helpers.js`). Todas las respuestas JSON llevan `Cache-Control: no-store`.
  - Rutas `app/api/v1/auth/`: `register`, `verify-email`, `resend-verification`, `login`, `refresh` (POST) y `me` (GET).
  - `scripts/create-admin.js` / `npm run create-admin`: único modo de crear un ADMINISTRADOR (RN-05). Ej.: `ADMIN_PASSWORD='Clave1234' DATABASE_URL=... npm run create-admin -- "Nombre Apellido" correo@dominio.co CC 12345678 3001234567`.
- **Limitaciones conocidas (no resueltas, decidir o implementar)**:
  1. **Inactividad de 30 min (RN-09) NO se aplica**: el JWT no tiene estado; el acceso dura 1 h aunque no haya actividad. Requiere guardar última actividad o acortar el token.
  2. **RN-29/RN-30 con retraso**: un usuario desactivado o con rol cambiado conserva su token de acceso hasta 1 h (el `refresh` sí consulta la BD). Aún no existe el módulo de administración de usuarios (RF-08).
  3. Sin revocación ni rotación del refresh token; sin «cerrar sesión en todas las pestañas» (RI-09, es del cliente).
  4. El enlace del correo apunta a `/verificar-correo?token=…`, **página que no existe** (hoy se verifica con `POST /auth/verify-email`).
  5. **`autor_id` de proyectos sigue siendo texto sin FK**; ahora contiene el `id` del usuario como cadena. Migrar a FK exige decidir qué hacer con filas de prueba (`p1`…).
  6. **Sequelize sigue sin aplicarse**: el repositorio de usuarios también usa `pg`. Hay ahora dos repositorios con SQL (`projects`, `auth`) que migrar.
  7. Sin límite de tasa (100 req/min) en la API; el bloqueo por cuenta es la única defensa contra fuerza bruta. `bcryptjs` (JS puro) en lugar de `bcrypt` nativo: más lento, mismo formato de hash.
- **Suposición nueva a confirmar**: el mensaje 423 al bloquear y el 410 al expirar el token son decisiones de diseño de la API (el ERS no fija códigos HTTP para esos casos).
- **No hecho**: solicitudes (migración 003, repositorio y rutas), interfaz web, correo con proveedor real, `docker-compose.yml` sin probar.

## Sesión 5 — resumen
**El entorno siguió sin red, sin PostgreSQL y sin `node_modules`** (mismo bloqueo que en la sesión 4), por lo que no se pudo hacer el «próximo paso» (instalar `sequelize`/`bcryptjs`, probar `002_usuarios.sql`, re-ejecutar las 23 pruebas de BD). Se añadió lógica de dominio pura, verificable sin BD:
- **Verificado** (`npm run test:unit` → **16/16**: 8 de auth de la sesión 4 + 8 nuevas):
  - `src/requests/domain.js` (RF-07): crear solicitud (admin vetado RN-25, validación por campo, no a sí mismo), duplicadas activas en cualquier sentido (FA-01), responder aceptar/rechazar/contraproponer solo el receptor, solicitud cerrada inmodificable (RN-26), historial fechado (RN-28), visibilidad (RN-27).
  - `src/auth/verification.js` (RN-03): token aleatorio, solo se guarda el hash SHA-256, expira a las 24 h; estados `valido`/`expirado`/`usado`/`invalido`.
- **Suposición a confirmar**: la contrapropuesta cierra la original (estado `contrapropuesta`) y crea una solicitud nueva pendiente con emisor/receptor invertidos, enlazada por `origenId` (el ERS solo dice «reenviar la solicitud modificada»).
- **No hecho / sin tocar**: tablas y rutas de solicitudes (falta migración `003`, repositorio y rutas), rutas de autenticación, Sequelize, bcrypt. Nada de esta sesión toca la BD ni Next.js; `002_usuarios.sql` sigue sin ejecutarse.

## Sesión 4 — resumen
**Entorno sin red, sin PostgreSQL y sin `node_modules`**: no se pudo instalar nada ni ejecutar las 23 pruebas de BD ni `next build` en esta sesión. Se avanzó solo con código que usa módulos nativos de Node y es verificable sin BD.
- **Hecho y verificado** (`npm run test:auth` → **8/8**): `src/auth/jwt.js` (JWT HS256, acceso 1 h / refresco 7 d, rechaza expirado, firma alterada, `alg=none`, tipo equivocado), `src/auth/lockout.js` (5 fallos → bloqueo 30 min; inactividad 30 min), `src/auth/registration.js` (validación de RF-01).
- **Escrito pero NO ejecutado**: `db/migrations/002_usuarios.sql` (tablas `usuarios`, `verificaciones_correo`). Probar con `npm run migrate` en una máquina con PostgreSQL antes de apoyarse en ella.
- **No tocado**: rutas, servicio de proyectos y cabeceras temporales. Las 23 pruebas previas no se re-ejecutaron (el estado de la sesión 3 sigue siendo el último verificado).
- **Decisión del equipo aplicada (ORM, pendiente 1 → elección libre)**: se elige **Sequelize**. Motivos: JavaScript sin TypeScript (como el proyecto), soporte nativo de tipos `GEOMETRY` de PostGIS (Prisma los trata como `Unsupported`, lo que obligaría a SQL crudo en terrenos, RF-03) y convive con las migraciones SQL existentes. **Aún no implementado**: el cambio se hará solo en `src/projects/repository.js` (única capa con SQL) cuando haya red para instalarlo y PostgreSQL para probarlo.
- **Decisión del equipo (pendiente 4)**: la ubicación deseada del proyecto se mantiene como **texto libre** por ahora (cerrada).
- Suposiciones nuevas a confirmar con el docente: 1 o 2 perfiles al registrarse (lectura literal de «varios, pero no los tres»); tipos de documento CC/CE/TI/PASAPORTE/NIT; contraseña de 8–72 caracteres con letra y número; `JWT_SECRET` obligatorio (≥32 caracteres).
- Contraseñas: el ERS exige **bcrypt**; falta instalar `bcryptjs` (o `bcrypt`) y no se sustituyó por otro algoritmo para no desviarse de RN-10.

## Estado actual en una línea
API de proyectos, de autenticación JWT + RBAC **y de solicitudes (RF-07)** funcionales y probadas (72/72 sobre PostgreSQL 16 real) y **interfaz web mínima** (registro, verificación, login, solicitudes), como aplicación **Next.js 16 + PostgreSQL**. Sin interfaz de proyectos/terrenos/administración, sin ORM (SQL parametrizado con `pg`).

## Decisiones tomadas por el equipo (2026-11-17)
| # | Decisión | Aplicada |
|---|---|---|
| 1 | Usar Next.js y PostgreSQL | Sí (sesión 3) |
| 3 | Todos los campos del proyecto son obligatorios | Sí: nombre, descripción, tipo de cultivo, área, ubicación deseada, monto y tiempo de retorno (validación + `NOT NULL` en BD) |
| 4 | Un proyecto cerrado queda cerrado (no se edita ni se reabre) | Sí (409 al editar/cerrar de nuevo/cambiar documento) |
| 1b | ORM: elección libre → Sequelize | Decidido (sesión 4); implementación pendiente |
| 4b | Ubicación del proyecto como texto libre | Sí (ya era así) |
| 9 | Por ahora, cualquier usuario autenticado puede descargar el PDF | Sí (de un proyecto visible para él; ver riesgo RN-21 abajo) |

## Funcionalidades completadas (verificadas)
Rutas Next.js en `app/api/v1/projects/…` (route handlers, `runtime = nodejs`):
- `POST /api/v1/projects` — publica proyecto; estado inicial `activo` (RN-16). Solo PRODUCTOR o ADMINISTRADOR.
- `GET /api/v1/projects` — lista solo proyectos `activo`.
- `GET /api/v1/projects/mine` — todos los proyectos del autor (incluye cerrados).
- `GET /api/v1/projects/:id` — activo visible a todo usuario autenticado; cerrado solo autor/admin (404 para los demás). Incluye `documento` (metadatos) o `null`.
- `PATCH /api/v1/projects/:id` — edición parcial, solo autor o admin (RN-18); no se puede vaciar un campo; cerrado → 409.
- `POST /api/v1/projects/:id/close` — cierre definitivo (autor o admin).
- `PUT|GET|DELETE /api/v1/projects/:id/document` — PDF de soporte, máximo uno por proyecto (RN-17). Valida `%PDF-`, no vacío, `Content-Type: application/pdf`, tamaño (413; 5 MB por defecto, `MAX_DOC_BYTES`). Nombre de archivo saneado.
- Validaciones: área y monto > 0 con máximo 2 decimales y tope por columna `NUMERIC`; meses entero 1–600; errores por campo. IDs inválidos o fuera de rango → 404 (no 500).
- Base de datos: `db/migrations/001_proyectos.sql` (tablas `proyectos` y `proyecto_documentos`, con `CHECK` que repiten las reglas del servicio) y runner `npm run migrate` (idempotente, cada migración atómica, registro en `schema_migrations`).

## Verificación (sesión 3, histórica; el estado vigente es el de la sesión 6: 52/52)
- `npm test` → **23/23 pasan** contra PostgreSQL 16.15 real: `projects.test.js` (11), `documents.test.js` (9), `db.test.js` (3: idempotencia de migraciones, restricciones de la BD, migración fallida sin efectos parciales). Cada ejecución crea y borra una base temporal.
- `npm run build` (Next.js 16.4.6, Turbopack) compila sin errores; rutas de API listadas como dinámicas.
- Prueba con servidor real (`next start` + `curl`): página `/` 200; crear 201; falta de campo 400; sin sesión 401; subir PDF 200; descarga idéntica (`cmp`); PDF de 6 MB → 413; cerrar 200 y editar 409.
- ZIP final: extraído en carpeta limpia y verificado desde esa copia: `npm ci` OK, 23/23 pruebas, `migrate` sobre base vacía OK, `build` OK, y con `next start`: crear 201, subir un PDF de 4 MB 200 y descarga idéntica byte a byte (`cmp`), detalle con metadatos del documento, 0 errores en el log del servidor.
- No verificado: `docker-compose.yml` (no había demonio Docker); la cobertura de código no se ha medido (el ERS pide ≥70%); la interfaz.

## Cómo ejecutar
Requisitos: Node >= 22.13 y PostgreSQL 16 (local o `docker compose up -d`).
```
npm ci
cp .env.example .env.local        # en Windows PowerShell: Copy-Item .env.example .env.local
npm run migrate                   # crea las tablas (usa DATABASE_URL)
npm run dev                       # desarrollo en http://localhost:3000
npm run build && npm start        # producción
```
Pruebas (requieren un usuario que pueda crear bases de datos):
```
# bash:        TEST_DATABASE_URL=postgres://usuario:clave@localhost:5432/postgres npm test
# PowerShell:  $env:TEST_DATABASE_URL="postgres://usuario:clave@localhost:5432/postgres"; npm test
```
`.env.local` lo carga Next.js, pero `npm run migrate` y `npm test` leen variables de entorno del sistema (no `.env.local`); defínelas en la terminal como arriba.

Autenticación: define `JWT_SECRET` (≥32 caracteres) en `.env.local`. Flujo: `POST /api/v1/auth/register` → verificar con el token que aparece en el log del servidor (`[correo:desarrollo] …?token=…`) mediante `POST /api/v1/auth/verify-email {"token":"…"}` → `POST /api/v1/auth/login` → usar `Authorization: Bearer <accessToken>`. Para crear un administrador: `npm run create-admin` (ver sesión 6).
```
curl -X PUT localhost:3000/api/v1/projects/1/document -H "authorization: Bearer $TOKEN" -H "content-type: application/pdf" -H "x-filename: plan.pdf" --data-binary @plan.pdf
```
Atajo solo para desarrollo: con `ALLOW_DEV_HEADERS=true` se aceptan `x-user-id` / `x-user-roles` (ignorado en producción).

## Archivos
- Configuración: `package.json`, `package-lock.json`, `next.config.mjs`, `.env.example`, `.gitignore`, `docker-compose.yml`.
- Documentación: `PROGRESS.md`, `CLAUDE_CONTEXT.md` (copia del archivo del Project; el del Project es el original y esta copia puede quedar desfasada). `CLAUDE.md` no existe.
- `app/` — Next.js: `layout.js`, `page.js` (provisional), `globals.css` (paleta y Times New Roman), y las rutas `api/v1/projects/**/route.js`.
- `src/http/api.js` — ayudantes HTTP: usuario temporal, lectura limitada del cuerpo, `parseId`, manejo de errores.
- `src/server/container.js` — servicio singleton (pool de `pg`).
- `src/projects/` — `service.js` (reglas y permisos), `validation.js`, `repository.js` (SQL), `errors.js`.
- `src/auth/` — `jwt.js`, `lockout.js`, `registration.js`, `verification.js` (puros), `repository.js`, `service.js`, `mailer.js` (sesión 6). `src/requests/domain.js` (RF-07, solo lógica pura, sin BD).
- `app/api/v1/auth/**/route.js` — rutas de autenticación. `scripts/create-admin.js`.
- `src/db/` — `pg.js` (conexión y `tx`), `migrate.js` (runner). `scripts/migrate.js` — CLI. `db/migrations/001_proyectos.sql`.
- `test/` — `helpers.js`, `projects.test.js`, `documents.test.js`, `db.test.js`, `authflow.test.js`, `requests.test.js`.
- `src/ui/` (cliente: sesión y formato), `app/components/`, `scripts/e2e/` (sesión 8).
- `src/requests/` — `domain.js` (puro), `repository.js`, `service.js` (sesión 7); `app/api/v1/requests/**`; `db/migrations/003_solicitudes.sql`.
- **Eliminado en esta sesión**: `src/server.js` (servidor `node:http`) y el uso de SQLite.

## Decisiones pendientes / suposiciones
1. **ORM (decidido: Sequelize, ver sesión 4)**: el ERS (RI-10) pide interactuar con PostgreSQL "mediante ORM" (Prisma o Sequelize), pero no se ha elegido. Se usó SQL parametrizado con `pg` y migraciones SQL propias para no inventar la decisión. El repositorio es la única capa que toca SQL. Confirmar si se adopta Prisma/Sequelize.
2. **Autenticación**: resuelta en la sesión 6 (JWT + RBAC); ver «Limitaciones conocidas» de esa sesión (inactividad 30 min, revocación, etc.).
3. **Multi-rol**: el servicio acepta lista de roles; falta aclarar el límite (uno o dos; ver CLAUDE_CONTEXT, punto 5).
4. **Ubicación deseada**: texto libre; no hay geolocalización PostGIS todavía (el ERS exige PostGIS para terrenos).
5. **IDs**: enteros autoincrementales (`IDENTITY`); definir si se usarán UUID.
6. **`autor_id`** es texto sin clave foránea; la tabla de usuarios ya existe (ver limitación 5 de la sesión 6).
7. **PDF**: se guarda en una columna `BYTEA` con límite de 5 MB (suposición; el ERS no define tamaño). En producción conviene almacenamiento de objetos y validar más a fondo que la cabecera `%PDF-` (antivirus o análisis de estructura).
8. **Riesgo asumido (decisión 9)**: RN-21 dice que la información financiera se muestra resumida hasta que exista una solicitud aceptada. Si los PDF contienen datos financieros, esta decisión lo contradice. Revisar cuando exista el módulo de solicitudes (RF-07).
9. **"Acuerdo PDF" vs "documento de soporte PDF"**: son cosas distintas. El documento de soporte (RN-17) está hecho. La **generación automática de acuerdos de tenencia en PDF** (objetivo y Sprint 2) **no está implementada** y no figura como RF; sigue pendiente de confirmar.
10. **Next.js**: se usa App Router con JavaScript (sin TypeScript) y sin alias de rutas; las pruebas llaman directamente a los manejadores de ruta (no arrancan Next). Si el equipo prefiere TypeScript, es un cambio aparte.

## Problemas encontrados
- Sesión 1: `npm test` fallaba porque Node 22 no acepta un directorio como argumento de `--test`. Corregido.
- Sesión 3: sin bloqueos. PostgreSQL real estaba disponible en el entorno de trabajo (versión 16), por lo que no se usó ningún emulador.
- Subida real de PDF grande: verificada (4 MB aceptado y devuelto idéntico; 6 MB rechazado con 413). Sin problemas pendientes de esta sesión.

## Tareas pendientes (en orden sugerido)
1. ~~Solicitudes (RF-07)~~ **hecho en la sesión 7**; pendiente confirmar sus suposiciones y aplicar RN-21 cuando exista la vista de detalle financiero.
2. Interfaz web: **registro, verificación, login y solicitudes hechos (sesión 8)**; **«Mis proyectos», «Publicar» y detalle hechos (sesión 9)**; faltan edición de proyectos, buscador/listado público (RF-05/06) y la UI de terrenos y administración.
3. Cerrar limitaciones de auth: inactividad 30 min (RN-09), efecto inmediato de desactivación/cambio de rol (RN-29/30), FK `autor_id`, rate limiting (100 req/min).
4. Proveedor de correo real (decisión pendiente).
5. Filtros y búsqueda de proyectos (RF-06) y consulta para inversionistas (RF-05).
6. Administración (RF-08) y moderación: estado `oculto`, auditoría (RF-09, RN-31, RN-32 a RN-34).
7. Documentación OpenAPI/Swagger (RI-08) y HTTPS en despliegue.
8. Migrar `projects/repository.js` y `auth/repository.js` a Sequelize; medir cobertura (≥70%) y rendimiento (API < 500 ms p95).
9. Generación del acuerdo de tenencia en PDF, solo tras confirmar su alcance.

## Próximo paso recomendado
**Búsqueda y oportunidades (RF-05/RF-06), backend + UI**: ampliar `GET /api/v1/projects` con filtros combinables (texto, tipo de cultivo, rango de área y de monto, orden por fecha) con pruebas sobre PostgreSQL, y una página `/oportunidades` (todos los roles autenticados) que los use, con detalle y botón «Enviar solicitud» (RN-21: información financiera resumida hasta que haya solicitud aceptada — decidir qué se oculta). Ubicación por radio (5/10/25/50 km) y terrenos dependen de PostGIS y de la tabla de terrenos (RF-03): dejarlos para una sesión aparte. Antes, confirmar la decisión de tokens (localStorage vs cookie httpOnly).
En una máquina nueva: `npm ci`, PostgreSQL 16, `TEST_DATABASE_URL=… npm test` (deben pasar 72/72).
