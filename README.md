# HRIS · Portal de Autoservicio para Empleados — Backend + Pipeline CI/CD

Backend (API REST en Node.js 20 + Express + PostgreSQL) del **Portal de Autoservicio para Empleados (HRIS) de M&S Mechanical LLC** y su pipeline de **GitHub Actions**, construidos a partir de:

- el **Plan de Pruebas del HRIS** (casos de caja negra CN-01 a CN-20 y pruebas unitarias PU-01 a PU-15), y
- el **documento técnico del pipeline CI/CD** (Ingeniería de Software III — Institución Universitaria EAM).

Cada push a `main` o `develop` ejecuta ESLint y las 15 pruebas unitarias con Jest; si una prueba falla o la cobertura de `src/services` o `src/utils` baja del 80 %, **el pipeline se detiene y nada se despliega**. Si todo pasa, construye la imagen Docker, la publica en GitHub Container Registry y la despliega.

> 📘 **Para ejecutarlo paso a paso, sigue [`GUIA_INSTALACION.md`](GUIA_INSTALACION.md).**
> 🎬 Guion de la demostración en video: [`docs/GUION_VIDEO.md`](docs/GUION_VIDEO.md).

---

## Flujo del pipeline

```
  push a develop / main ─┐      pull_request a main ─┐      workflow_dispatch ─┐
                         ▼                           ▼                         ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │ JOB 1 · Build & Unit Tests  (la única puerta)                                    │
 │  checkout → setup-node 20 (caché npm) → npm ci → npm run lint (ESLint)           │
 │  → npm run test:ci (Jest: PU-01…PU-15 + cobertura ≥ 80 % en services y utils)    │
 │  → resumen PU por PU en el Summary + artefacto coverage-report   (if: always())  │
 └──────────────────────────────────────┬──────────────────────────────────────────┘
               ¿falla una prueba, ESLint │ o la cobertura?
                   sí ──► ❌ el run termina; docker-build y deploy quedan "skipped"
                                          │ no
                       ¿es pull request? ─┤
                   sí ──► ✅ fin (solo pruebas; el check habilita el merge)
                                          │ no
 ┌──────────────────────────────────────▼──────────────────────────────────────────┐
 │ JOB 2 · Docker Build & Push                                                       │
 │  ghcr.io/<owner-en-minúsculas>/hris-backend : <rama> · sha-xxxxxxx · latest(main) │
 └──────────────────────────────────────┬──────────────────────────────────────────┘
 ┌──────────────────────────────────────▼──────────────────────────────────────────┐
 │ JOB 3 · Deploy   environment = production (main) | staging (develop u otra rama)  │
 │  ¿existe el secreto SSH_HOST?                                                     │
 │   sí → SSH al servidor: pull · up -d · GET /health · .previous_tag (rollback)    │
 │   no → ambiente efímero en el runner: compose pull/up con .env aleatorio          │
 │        → deploy/smoke-test.sh (health + CN-01,02,03,04,07,08,12,13,19)            │
 │        → logs si falla → down -v                                                  │
 │  → resumen del despliegue en el Summary                                           │
 └─────────────────────────────────────────────────────────────────────────────────┘
```

## Estructura

```
hris/
├── .github/workflows/ci-cd.yml   # Pipeline: build-and-test → docker-build → deploy
├── backend/
│   ├── src/
│   │   ├── config/               # variables de entorno y roles
│   │   ├── db/                   # pool de pg (perezoso) + transacciones; DATE → 'YYYY-MM-DD'
│   │   ├── controllers/          # rutas Express (delgadas)
│   │   ├── middlewares/          # authenticate, authorize(roles), errorHandler, cors
│   │   ├── services/             # reglas de negocio: auth, 2FA, empleados, vacaciones, auditoría…
│   │   ├── repositories/         # ÚNICA capa que toca PostgreSQL
│   │   ├── utils/                # hash, JWT, TOTP, fechas/edad, validadores, DTO, errores
│   │   ├── app.js                # crea la app de Express
│   │   └── server.js             # arranque y apagado ordenado
│   ├── tests/unit/               # PU-01 … PU-15 (un archivo por caso)
│   ├── scripts/                  # totp.js (código 2FA) y ci-summary.js (resumen del pipeline)
│   ├── Dockerfile · .dockerignore · jest.config.js · eslint.config.js
│   └── package.json · package-lock.json
├── db/init.sql                   # esquema con constraints + datos semilla
├── docker-compose.yml            # ambiente LOCAL (construye el backend)
├── deploy/
│   ├── docker-compose.yml        # SERVIDOR: usa ${HRIS_IMAGE}:${IMAGE_TAG} de GHCR
│   └── smoke-test.sh             # prueba de humo con curl (health + 9 casos CN)
├── docs/
│   ├── GUION_VIDEO.md            # guion de la demostración (8–10 min)
│   └── ejemplos/sinPruebas.js    # archivo para provocar el fallo por cobertura
├── frontend/                     # frontend React (Vite) original, sin cambios; fuera del pipeline
├── .env.example · .gitignore · .gitattributes
├── README.md
└── GUIA_INSTALACION.md
```

## Inicio rápido

```bash
# Pruebas unitarias (no necesitan base de datos)
cd backend && npm ci && npm run lint && npm run test:ci

# Ambiente completo (API + PostgreSQL con datos semilla)
cd .. && docker compose up -d --build
bash deploy/smoke-test.sh            # health + CN-01,02,03,04,07,08,12,13,19
```

Usuarios semilla: `admin / Admin123*` (con 2FA), `lider / Lider123*`, `empleado1`, `empleado2`, `empleado3` / `Empleado123*`. El código 2FA del administrador se obtiene con `npm run totp` (en `backend/`) o con Google Authenticator usando el secreto `JBSWY3DPEHPK3PXP`. Detalle en la [guía](GUIA_INSTALACION.md#4-ambiente-completo-con-docker-compose).

## API

Todas las respuestas de error tienen la forma `{ "error": "<mensaje en inglés>" }` (más `details` en los errores de validación). Rutas y nombres de campos tomados del frontend (`frontend/src/api/*.js`).

| Método | Ruta | Roles | Casos |
|---|---|---|---|
| GET | `/health` | público | — |
| POST | `/api/auth/login` `{usuario, clave}` → `{token}` o `{requiereOtp, personaId}` | público | CN-01…04 |
| POST | `/api/auth/verify-otp` `{personaId, codigo}` → `{token}` | público (requiere login previo) | CN-05, CN-06 |
| GET | `/api/empleados` | Administrador (todos), Líder (su equipo) | CN-08 |
| GET | `/api/empleados/me` | todos | CN-12 |
| GET | `/api/empleados/:id` | Admin; Líder (su equipo); Empleado (solo el suyo) | CN-12, CN-13 |
| POST | `/api/empleados` | Administrador | CN-08…11 |
| PATCH | `/api/empleados/:id` | Administrador | CN-20 |
| GET/POST | `/api/contactos-emergencia/mis-contactos` | todos | CN-14 |
| GET | `/api/contactos-emergencia/persona/:personaId` | Admin; Líder (equipo); dueño | CN-14 |
| POST | `/api/contactos-emergencia` `{personaId, …}` | Admin o el dueño | CN-14 |
| GET | `/api/permisos/saldo` · `/api/permisos/mias` · `/api/permisos/:id` | todos (lo propio) | CN-15…17 |
| GET | `/api/permisos/revision?estado=&limite=&offset=` | Administrador, Líder | CN-17 |
| POST | `/api/permisos` `{tipo, fechaInicio, fechaFin, motivo}` | todos | CN-15, CN-16 |
| PATCH | `/api/permisos/:id/decision` `{decision: 'Aprobado'\|'Rechazado', comentario}` | Administrador, Líder (su equipo) | CN-17, CN-18 |
| GET | `/api/comprobantes/mis-comprobantes?anio=` | todos | CN-19 |
| GET | `/api/auditoria?fechaInicio=&fechaFin=&personaId=&accion=&pagina=&porPagina=` | Administrador | CN-20 |

## Trazabilidad de las pruebas unitarias

| Caso | Qué verifica (resultado esperado del plan) | Código bajo prueba | Archivo de prueba |
|---|---|---|---|
| PU-01 | `hashPassword()` / `comparePassword()`: true con la contraseña correcta, false con la incorrecta | `backend/src/utils/password.js` | `backend/tests/unit/PU-01.password.test.js` |
| PU-02 | `generateToken()`: el token decodificado contiene id, rol y exp correctos | `backend/src/utils/jwt.js` | `backend/tests/unit/PU-02.generateToken.test.js` |
| PU-03 | `verifyToken()`: error de autenticación con token expirado o firma inválida (temporizadores simulados) | `backend/src/utils/jwt.js` | `backend/tests/unit/PU-03.verifyToken.test.js` |
| PU-04 | Middleware de autenticación: sin header → 401; token válido → `req.user` + `next()` | `backend/src/middlewares/auth.js` | `backend/tests/unit/PU-04.authMiddleware.test.js` |
| PU-05 | `authorize(roles)`: rol no permitido → 403; permitido → `next()` | `backend/src/middlewares/auth.js` | `backend/tests/unit/PU-05.authorize.test.js` |
| PU-06 | 2FA TOTP: acepta el código vigente; rechaza inválido o fuera de ventana (vectores RFC 6238, tiempo simulado, flujo de login) | `backend/src/utils/totp.js`, `backend/src/services/twoFactorService.js`, `backend/src/services/authService.js` | `backend/tests/unit/PU-06.twoFactor.test.js` |
| PU-07 | `calcularEdad()`: cumpleaños hoy, mañana y 29 de febrero | `backend/src/utils/dates.js` | `backend/tests/unit/PU-07.calcularEdad.test.js` |
| PU-08 | Validador de empleado: errores en inglés para datos inválidos; ninguno para válidos | `backend/src/utils/validators.js` | `backend/tests/unit/PU-08.validadorEmpleado.test.js` |
| PU-09 | Días de una solicitud: cantidad correcta; error si fin < inicio | `backend/src/utils/dates.js` | `backend/tests/unit/PU-09.diasVacaciones.test.js` |
| PU-10 | Servicio de vacaciones (repo mockeado): rechaza si excede saldo; al aprobar descuenta exactamente los días | `backend/src/services/vacacionesService.js` | `backend/tests/unit/PU-10.vacacionesService.test.js` |
| PU-11 | Transición de estados: Pendiente → Aprobado/Rechazado; desde un estado final → error 409 | `backend/src/utils/estadoSolicitud.js` | `backend/tests/unit/PU-11.estadoSolicitud.test.js` |
| PU-12 | Empleados (repo mockeado): documento duplicado → `ConflictError` y no se llama a `insert` | `backend/src/services/empleadoService.js` | `backend/tests/unit/PU-12.empleadoService.test.js` |
| PU-13 | Auditoría: registra con usuario autenticado; ignora acciones del sistema | `backend/src/services/auditService.js` | `backend/tests/unit/PU-13.auditService.test.js` |
| PU-14 | Manejador global de errores: código HTTP por tipo, mensaje en inglés, sin stack en producción | `backend/src/middlewares/errorHandler.js` | `backend/tests/unit/PU-14.errorHandler.test.js` |
| PU-15 | DTO de persona: excluye el hash de contraseña y el secreto 2FA | `backend/src/utils/personaDto.js` | `backend/tests/unit/PU-15.personaDto.test.js` |

Cada archivo de prueba empieza con un comentario que copia el resultado esperado del plan, y su `describe` principal empieza con `PU-xx · …`, de modo que la salida de Jest (`verbose: true`) y el resumen del pipeline se leen caso por caso.

## Cómo se aplican los criterios del plan de pruebas

| Criterio del plan | Cómo lo aplica este repositorio |
|---|---|
| 100 % de las pruebas unitarias pasan (`npm test` en verde) | Si Jest termina con código ≠ 0, el job **Build & Unit Tests** falla y **Docker Build & Push** y **Deploy** quedan en *skipped*. |
| Cobertura de servicios y utilidades ≥ 80 % | `coverageThreshold` en `backend/jest.config.js` (`./src/services/` y `./src/utils/`, 80 % de líneas). `roots` incluye `src/` para que los archivos sin pruebas cuenten con 0 %. |
| Pruebas aisladas de la base de datos (mocks) | Las PU usan `jest.mock` sobre los repositorios; el runner no levanta PostgreSQL. Solo `src/repositories/` importa `src/db/pool.js`. |
| Rechazo si alguna PU falla | La protección de `main` exige el check **Build & Unit Tests**: un PR con una prueba roja no se puede fusionar. |
| Rechazo si se expone información sensible | DTO con lista blanca (PU-15); el manejador de errores nunca envía el stack en producción (PU-14); el mismo 401 "Invalid credentials" para usuario inexistente y contraseña incorrecta. |
| Rechazo si el Administrador entra sin 2FA | El login del Administrador nunca entrega el token; solo `verify-otp` con un TOTP válido **y** un reto de login vigente (5 min) lo emite. Sin 2FA configurado → 403. |
| Mensajes al usuario en inglés | Todos los mensajes de error y validación de la API están en inglés (verificados en PU-04, 06, 08, 14 y en el smoke test). |
| Casos CN contra el ambiente desplegado | El job **Deploy** ejecuta `deploy/smoke-test.sh` (health + CN-01, 02, 03, 04, 07, 08, 12, 13, 19). El resto de CN se ejecutan manualmente en Insomnia (o con los `curl` de la guía). |

## Tecnologías

Node.js 20 · Express 4 · pg 8 · jsonwebtoken 9 · bcryptjs · Jest 29 · ESLint 9 (flat config) · PostgreSQL 16 · Docker / Docker Compose · GitHub Actions · GitHub Container Registry.
