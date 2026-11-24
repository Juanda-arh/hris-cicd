# Guía de instalación y ejecución del pipeline CI/CD del HRIS

Esta guía lleva paso a paso desde clonar el repositorio hasta ver el pipeline en verde, romperlo a propósito y comprobar que se detiene. Está pensada para quien evalúa el taller: cada comando y cada edición se pueden copiar tal cual.

**Contenido**

1. [Requisitos](#1-requisitos)
2. [Obtener el repositorio (fork o repositorio nuevo)](#2-obtener-el-repositorio)
3. [Pruebas unitarias en local](#3-pruebas-unitarias-en-local)
4. [Ambiente completo con Docker Compose](#4-ambiente-completo-con-docker-compose)
5. [Configuración en GitHub](#5-configuración-en-github)
6. [Parámetros del pipeline](#6-parámetros-del-pipeline)
7. [Ejecutar el pipeline y leer los resultados](#7-ejecutar-el-pipeline-y-leer-los-resultados)
8. [Provocar fallos a propósito](#8-provocar-fallos-a-propósito)
9. [Ejecutar el job de pruebas en local con act](#9-ejecutar-el-job-de-pruebas-en-local-con-act)
10. [Despliegue en un servidor por SSH y rollback](#10-despliegue-en-un-servidor-por-ssh-y-rollback)
11. [Solución de problemas](#11-solución-de-problemas)
12. [Decisiones tomadas ante ambigüedades del plan](#12-decisiones-tomadas-ante-ambigüedades-del-plan)

---

## 1. Requisitos

| Herramienta | Versión | Para qué | Comprobar |
|---|---|---|---|
| Git | 2.x | clonar y hacer push | `git --version` |
| Cuenta de GitHub | — | ejecutar el pipeline (Actions y GHCR son gratis en repos públicos) | — |
| Node.js | 20 o superior (con npm) | pruebas unitarias en local | `node -v` |
| Docker Desktop / Docker Engine | Compose v2.20 o superior | ambiente local (API + PostgreSQL) | `docker compose version` |
| Bash + curl + Python 3 | — | `deploy/smoke-test.sh` (en Windows: **Git Bash**) | `bash --version`, `python3 --version` (o `python --version`) |
| GitHub CLI (`gh`) | opcional | crear el repositorio y abrir PR desde la terminal | `gh --version` |
| act | opcional | ejecutar el job de pruebas en local (sección 9) | `act --version` |
| App autenticadora | opcional | Google Authenticator, Microsoft Authenticator, Authy… para el 2FA | — |

> En **Windows** ejecuta los comandos de esta guía en **Git Bash**. En PowerShell `curl` es un alias de `Invoke-WebRequest`; si lo usas, escribe `curl.exe`.

---

## 2. Obtener el repositorio

Elige **una** de las dos opciones.

### Opción A — Fork (recomendada para evaluar)

1. En la página del repositorio, pulsa **Fork**.
2. **Desmarca** *Copy the `main` branch only* para que el fork incluya también la rama `develop`.
3. En el fork, abre la pestaña **Actions**. GitHub deshabilita los workflows en los forks: pulsa **I understand my workflows, go ahead and enable them**.
4. Clona tu fork:

   ```bash
   git clone https://github.com/<tu-usuario>/<repo>.git
   cd <repo>
   git checkout develop
   ```

> Si el fork no trae `develop`, créala: `git checkout -b develop && git push -u origin develop`.
> Un fork **no** copia environments, secretos ni reglas de protección: se configuran en la sección 5.

### Opción B — Repositorio nuevo propio

```bash
git clone https://github.com/<owner-original>/<repo>.git hris
cd hris
git remote remove origin

# Con GitHub CLI (crea el repo público y sube main):
gh repo create <tu-usuario>/hris --public --source=. --remote=origin --push
git push -u origin develop

# Sin GitHub CLI: crea un repo vacío en github.com y luego
git remote add origin https://github.com/<tu-usuario>/hris.git
git push -u origin main
git push -u origin develop
```

Los repositorios nuevos tienen Actions habilitado por defecto. El primer push ya dispara el pipeline.

---

## 3. Pruebas unitarias en local

No necesitan base de datos ni archivo `.env`: los repositorios se simulan con `jest.mock` y `tests/setup-env.js` define un `JWT_SECRET` de prueba.

```bash
cd backend
npm ci                 # instala exactamente lo que dice package-lock.json
npm run lint           # ESLint (equivale a la "compilación" en el pipeline)
npm test               # Jest: PU-01 … PU-15 con el detalle de cada prueba
npm run test:ci        # lo mismo que corre el pipeline: --ci --coverage --runInBand --json
node scripts/ci-summary.js   # el resumen en Markdown que el pipeline publica en el Summary
cat coverage/coverage.txt    # tabla de cobertura por archivo
```

Resultado esperado de `npm run test:ci`: `Test Suites: 15 passed, 15 total`, código de salida 0 y la cobertura de `src/services` y `src/utils` por encima del 80 %. El reporte navegable queda en `backend/coverage/lcov-report/index.html`.

> `npm run test:ci` guarda la salida de Jest en `coverage/jest-results.json`; por eso en la consola solo se ven las pruebas, no la tabla de cobertura (Jest la silencia con `--json`). La misma tabla queda en `coverage/coverage.txt` y el pipeline la imprime en un paso propio.

---

## 4. Ambiente completo con Docker Compose

Levanta PostgreSQL 16 (con `db/init.sql`: esquema + datos semilla) y la API construida desde `backend/`. Funciona sin `.env`; si quieres cambiar contraseñas o el `JWT_SECRET`, copia `.env.example` a `.env` y edítalo.

```bash
# desde la raíz del repositorio
docker compose up -d --build
docker compose ps                         # api y db en estado "healthy"
curl http://localhost:3000/health         # {"status":"ok","database":"up",...}
bash deploy/smoke-test.sh                 # health + CN-01, 02, 03, 04, 07, 08, 12, 13 y 19
```

Para volver a los datos semilla (por ejemplo después de aprobar solicitudes), como dice el plan de pruebas:

```bash
docker compose down -v && docker compose up -d
```

### Usuarios semilla

| Usuario (o correo) | Contraseña | Rol | Datos útiles para los casos CN |
|---|---|---|---|
| `admin` (`admin@msmechanical.test`) | `Admin123*` | Administrador | 2FA con el secreto `JBSWY3DPEHPK3PXP` (id 1) |
| `lider` (`lider@msmechanical.test`) | `Lider123*` | Lider | líder de los 3 empleados (id 2) |
| `empleado1` | `Empleado123*` | Empleado | Ana Torres, **nacida el 29 de febrero de 2000**, saldo **15** días (id 3) |
| `empleado2` | `Empleado123*` | Empleado | Pedro Gómez, saldo **10** días (id 4) |
| `empleado3` | `Empleado123*` | Empleado | Sofía Rojas, saldo **5** días (id 5) |

Todos tienen comprobantes de pago (excepto el administrador) y `empleado1` y `empleado2` tienen un contacto de emergencia.

### Código 2FA del Administrador

El login del Administrador responde `{"requiereOtp": true, "personaId": 1}` y **no** entrega token. El token se obtiene en `POST /api/auth/verify-otp` con el código de 6 dígitos (válido 30 s; se acepta también el del paso anterior y el siguiente). El código debe enviarse **dentro de los 5 minutos** siguientes al login: el código por sí solo, sin un login previo, no da acceso.

Formas de obtener el código:

```bash
cd backend && npm run totp                 # requiere haber hecho npm ci
docker compose exec api npm run totp       # dentro del contenedor, sin instalar nada
cd backend && npm run totp -- --uri        # imprime además el enlace otpauth:// para la app
```

En **Google Authenticator**: *Agregar código → Ingresar clave de configuración*, nombre `HRIS admin`, clave `JBSWY3DPEHPK3PXP`, tipo *Basado en el tiempo*. (O genera un QR con el enlace `otpauth://` que imprime `npm run totp -- --uri`.)

### Recorrido con curl (para Insomnia usa los mismos cuerpos JSON)

```bash
API=http://localhost:3000

# CN-01: login de empleado -> token
curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' \
     -d '{"usuario":"empleado1","clave":"Empleado123*"}'

# CN-04 y CN-05: login del administrador y luego el código 2FA
curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' \
     -d '{"usuario":"admin","clave":"Admin123*"}'
CODIGO=$(docker compose exec -T api node scripts/totp.js --quiet)
curl -s -X POST $API/api/auth/verify-otp -H 'Content-Type: application/json' \
     -d "{\"personaId\":1,\"codigo\":\"$CODIGO\"}"

# Usar el token (reemplaza <TOKEN>)
curl -s $API/api/empleados/me -H "Authorization: Bearer <TOKEN>"
```

Cuerpos de ejemplo del resto de casos:

| Caso | Petición |
|---|---|
| CN-09 | `POST /api/empleados` (Admin) `{"nombre":"Valentina Castro","cedula":"1094111222","correo":"valentina.castro@msmechanical.test","fechaNacimiento":"1996-03-14","telefono":"3001112233","eps":"Sura","arl":"Positiva","fondoPension":"Porvenir","cesantias":"Porvenir","liderId":2,"clave":"Empleado123*"}` → 201 |
| CN-10 | repetir el POST anterior → 409 `An employee with this document number already exists` |
| CN-11 | `fechaNacimiento` futura o de alguien con 17 años → 400; con exactamente 18 años hoy → 201 |
| CN-14 | `POST /api/contactos-emergencia/mis-contactos` `{"nombre":"Jorge Torres","parentesco":"Father","telefono":"3101112222","ciudad":"Armenia"}` (varias veces) y `GET` a la misma ruta |
| CN-15 | con `empleado3` (saldo 5): `POST /api/permisos` `{"tipo":"Vacaciones","fechaInicio":"2027-03-01","fechaFin":"2027-03-05"}` → 201 `Pendiente` |
| CN-16 | con `empleado2` (saldo 10): `{"tipo":"Vacaciones","fechaInicio":"2027-03-01","fechaFin":"2027-03-15"}` (11 días hábiles) → 400; `fechaFin` antes de `fechaInicio` → 400 |
| CN-17 | con `lider`: `PATCH /api/permisos/<id>/decision` `{"decision":"Aprobado"}` → 200; `GET /api/permisos/saldo` de `empleado3` → `diasDisponibles: 0` |
| CN-18 | repetir la decisión (o `{"decision":"Rechazado"}`) → 409 |
| CN-20 | Admin: `PATCH /api/empleados/4` `{"eps":"Sanitas"}` → 200; `GET /api/auditoria?accion=ACTUALIZAR_EMPLEADO` → registro con `usuario`, `accion` y `fecha` |

### Frontend (opcional, fuera del pipeline)

```bash
cd frontend
cp .env.example .env     # VITE_API_URL=http://localhost:3000
npm install && npm run dev   # http://localhost:5173 (origen permitido por CORS)
```

Ver la nota sobre los nombres de rol en la [sección 12](#12-decisiones-tomadas-ante-ambigüedades-del-plan).

---

## 5. Configuración en GitHub

Con la configuración por defecto de un repositorio nuevo **el pipeline ya funciona completo** (pruebas, imagen y despliegue de prueba en el runner). Los pasos siguientes agregan los controles del documento técnico (aprobación de producción, PR bloqueado si fallan las pruebas y despliegue real por SSH).

### 5.1 Actions y permisos del token

*Settings → Actions → General*:

- **Actions permissions**: *Allow all actions and reusable workflows* (el workflow usa acciones de `actions/`, `docker/` y `appleboy/`).
- **Workflow permissions**: cualquiera de las dos opciones sirve, porque el workflow declara lo que necesita (`contents: read`, `packages: write`). Si tu organización bloquea esa elevación, elige *Read and write permissions*.

### 5.2 Environments `staging` y `production`

*Settings → Environments → New environment*. Si no los creas, GitHub los crea solos en la primera ejecución (sin protección).

| Environment | Rama que lo usa | Protección sugerida |
|---|---|---|
| `staging` | `develop` (y cualquier rama distinta de `main` lanzada a mano) | ninguna: despliega automáticamente |
| `production` | `main` | **Required reviewers** (opcional): agrega tu usuario; el job *Deploy* quedará en *Waiting* hasta que pulses **Review deployments → Approve and deploy** |

### 5.3 Protección de la rama `main`

*Settings → Branches → Add branch ruleset* (o *Add classic branch protection rule*) para `main`:

- ✅ *Require a pull request before merging*.
- ✅ *Require status checks to pass* → busca y agrega **`Build & Unit Tests`**. El check aparece en la lista solo después de que el workflow haya corrido al menos una vez.
- ✅ *Block force pushes* (y, si quieres, *Restrict deletions*).

Con esto, un PR hacia `main` con una prueba unitaria roja no se puede fusionar: el criterio de rechazo del plan aplicado automáticamente.

### 5.4 Secretos (opcionales)

Solo si quieres desplegar en un servidor real (sección 10). Se crean **dentro de cada environment** (*Settings → Environments → staging/production → Add environment secret*):

| Secreto | Contenido |
|---|---|
| `SSH_HOST` | IP o dominio del servidor. **Si no existe, el pipeline despliega en el runner** (ambiente efímero + prueba de humo). |
| `SSH_USER` | usuario del servidor con permiso para usar Docker |
| `SSH_PRIVATE_KEY` | llave privada SSH sin passphrase |
| `SSH_PORT` | puerto SSH (por defecto 22) |

`GITHUB_TOKEN` no se crea: lo genera GitHub en cada ejecución y sirve para publicar y descargar la imagen.

---

## 6. Parámetros del pipeline

| Parámetro | Dónde | Valor | Efecto |
|---|---|---|---|
| Eventos | `on:` | `push` a `main` y `develop`; `pull_request` a `main`; `workflow_dispatch` | qué dispara el pipeline |
| `concurrency` | raíz del workflow | grupo `ci-cd-<workflow>-<ref>`; cancela la ejecución anterior excepto en `main` | dos pushes seguidos a `develop` no despliegan en paralelo; en `main` se encolan |
| `permissions` | raíz del workflow | `contents: read`, `packages: write` | publicar y descargar de GHCR con `GITHUB_TOKEN` |
| `NODE_VERSION` | `env` | `20` | versión de Node en el runner |
| `REGISTRY` | `env` | `ghcr.io` | registro de imágenes |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV` | paso *Ejecutar pruebas unitarias* | `ci-test-secret`, `1h`, `test` | valores de prueba (no son secretos) |
| Umbral de cobertura | `backend/jest.config.js` → `coverageThreshold` | 80 % de líneas en `./src/services/` y `./src/utils/` (agregado por carpeta) | Jest falla si no se cumple |
| Artefacto | paso *Guardar reporte de cobertura* | `coverage-report`, 30 días | lcov, cobertura XML, JSON y tabla de texto |
| Imagen | job *Docker Build & Push* | `ghcr.io/<owner-en-minúsculas>/hris-backend` | GHCR rechaza mayúsculas |
| Etiquetas | `docker/metadata-action` | `<rama>`, `sha-<7 caracteres>`, `latest` (solo `main`) | el despliegue usa siempre `sha-…` |
| Environment | job *Deploy* | `production` si la rama es `main`; si no, `staging` | aprobaciones y secretos por ambiente |
| Modo de despliegue | job *Deploy* | SSH si existe `SSH_HOST`; si no, runner | ver secciones 7 y 10 |
| Directorio del servidor | script SSH | `/opt/hris` | donde viven `docker-compose.yml`, `db/init.sql` y `.env` |
| Directorio efímero | modo runner | `$RUNNER_TEMP/hris` | copia de `deploy/docker-compose.yml`, `db/init.sql`, `.env` (de `.env.example` con contraseñas aleatorias de `openssl rand`) y `smoke-test.sh` |
| Prueba de humo | `deploy/smoke-test.sh` | `BASE_URL`, `ADMIN_TOTP_SECRET`, `JWT_SECRET`, `SMOKE_READONLY`, `HEALTH_TIMEOUT` | health + CN-01, 02, 03, 04, 07, 08, 12, 13 y 19 |
| `timeout-minutes` | cada job | 15 / 20 / 20 | evita jobs colgados |

---

## 7. Ejecutar el pipeline y leer los resultados

### Escenario E1 — flujo exitoso en staging

```bash
git checkout develop
git commit --allow-empty -m "ci: ejecutar pipeline"
git push
```

(También puedes lanzarlo sin commit: *Actions → Pipeline CI/CD HRIS → Run workflow → Branch: develop*.)

En **Actions** verás tres jobs encadenados: **Build & Unit Tests → Docker Build & Push → Deploy**, los tres en verde (unos 3–5 minutos).

Dónde mirar:

| Qué | Dónde |
|---|---|
| Resumen PU-01…PU-15 (estado, pruebas, fallidas) y cobertura por capa | pestaña **Summary** de la ejecución |
| Cada prueba con ✓/✕ | job *Build & Unit Tests* → paso *Ejecutar pruebas unitarias (PU-01 a PU-15)* |
| Tabla de cobertura por archivo | paso *Tabla de cobertura por archivo* |
| Reporte navegable | **Artifacts → coverage-report** (descargar y abrir `lcov-report/index.html`) |
| Imagen publicada | perfil u organización → **Packages → hris-backend** (etiquetas `develop` y `sha-…`) |
| Despliegue y casos CN | job *Deploy* → paso *Prueba de humo (health + CN-01, …)*: cada verificación con ✓ |
| Resumen del despliegue | **Summary**: ambiente, destino, rama, commit e imagen |

Sin el secreto `SSH_HOST`, el job *Deploy* descarga la imagen recién publicada, levanta PostgreSQL + API en el runner con contraseñas aleatorias, ejecuta la prueba de humo, muestra los logs si algo falla y apaga todo con `docker compose down -v`. Así se demuestra el despliegue sin necesidad de un servidor.

### Escenario E3 — pull request a `main`

```bash
gh pr create --base main --head develop --title "Release" --body "Pipeline E3"
```

(o desde la web: *Pull requests → New → base: main ← compare: develop*.) En el PR solo corre **Build & Unit Tests**; con la protección de la sección 5.3 el botón *Merge* se habilita únicamente si el check está en verde. Al fusionar, el push a `main` ejecuta el pipeline completo y despliega en `production` (pidiendo aprobación si configuraste *Required reviewers*).

---

## 8. Provocar fallos a propósito

En todos los casos el resultado esperado es: **Build & Unit Tests en rojo, Docker Build & Push y Deploy en *skipped*** (gris), el Summary marca la causa y nada se despliega. Haz cada experimento en `develop` y revierte al terminar.

### E2 — una prueba unitaria falla (PU-09)

Archivo `backend/tests/unit/PU-09.diasVacaciones.test.js`, línea 12. Cambia

```js
    expect(contarDiasHabiles('2027-03-01', '2027-03-05')).toBe(5);
```

por

```js
    expect(contarDiasHabiles('2027-03-01', '2027-03-05')).toBe(4);
```

Con un comando (Linux o Git Bash; en macOS usa `sed -i ''`):

```bash
sed -i "s/'2027-03-05')).toBe(5)/'2027-03-05')).toBe(4)/" backend/tests/unit/PU-09.diasVacaciones.test.js
git commit -am "test: romper PU-09 a propósito" && git push
```

Lo que verás:

- Paso *Ejecutar pruebas unitarias*: `✕ de lunes a viernes de la misma semana son 5 días hábiles`, con `Expected: 4` y `Received: 5`; `Tests: 1 failed, 160 passed, 161 total`.
- Summary: **❌ Unit tests PU-01 … PU-15: FAILED — the pipeline stops here**, la fila PU-09 en ❌ con 1 fallida y la prueba listada en *Failed tests*.
- *Docker Build & Push* y *Deploy*: **skipped**. En GHCR no aparece una etiqueta nueva.

Para volver a verde: `git revert HEAD && git push`.

### E2-bis — el error está en el código, no en la prueba

Archivo `backend/src/utils/dates.js`, línea 64. Cambia

```js
    if (diaSemana !== 0 && diaSemana !== 6) {
```

por

```js
    if (diaSemana !== 0) {
```

(ahora los sábados cuentan como días hábiles). Fallan 3 pruebas de **PU-09** y 1 de **PU-10**: las pruebas detectan el defecto de negocio. Revierte con `git revert HEAD`.

### E3 — PR bloqueado

Con el commit de E2 todavía en `develop`, abre el PR `develop → main` (sección 7). El check **Build & Unit Tests** queda en rojo y, con la regla de la sección 5.3, GitHub muestra *Merging is blocked*. Después de `git revert HEAD && git push` en `develop`, el check se vuelve a ejecutar en el mismo PR y el merge se habilita.

### E4 — cobertura por debajo del 80 %

```bash
cp docs/ejemplos/sinPruebas.js backend/src/utils/sinPruebas.js
git add backend/src/utils/sinPruebas.js
git commit -m "feat: utilidad sin pruebas" && git push
```

Todas las pruebas pasan (`Tests: 161 passed`), pero Jest termina con código 1 y el mensaje:

```
Jest: "./src/utils/" coverage threshold for lines (80%) not met: 76.22%
```

El Summary muestra `src/utils` con **❌ below threshold** y el título del resumen en ❌. Para volver a verde: `git revert HEAD && git push` (o `git rm backend/src/utils/sinPruebas.js`).

> El umbral se mide sobre **toda la carpeta**: un archivo pequeño sin pruebas no alcanza para bajar el promedio. Por eso `docs/ejemplos/sinPruebas.js` tiene unas 70 líneas ejecutables. Si en algún momento la carpeta tiene más pruebas, puede hacer falta un archivo más grande.

### E5 — error de ESLint (antes de llegar a las pruebas)

```bash
echo "const sinUso = 1;" >> backend/src/app.js
git commit -am "chore: variable sin usar" && git push
```

Falla el paso *Validar código (ESLint)* con `'sinUso' is assigned a value but never used  no-unused-vars` y las pruebas ni siquiera se ejecutan. Revierte con `git revert HEAD`.

Todos estos escenarios se pueden comprobar primero en local: `cd backend && npm run lint && npm run test:ci; echo "exit=$?"` termina con `exit=1`.

---

## 9. Ejecutar el job de pruebas en local con act

[act](https://github.com/nektos/act) ejecuta los jobs de GitHub Actions dentro de contenedores Docker. Desde la raíz del repositorio:

```bash
act -j build-and-test --artifact-server-path /tmp/act-artifacts
```

- La primera vez act pregunta qué imagen usar: elige **Medium** (`catthehacker/ubuntu:act-latest`).
- `--artifact-server-path` es necesario para que funcione el paso `actions/upload-artifact`; sin él ese paso falla (solo en act).
- En Mac con Apple Silicon agrega `--container-architecture linux/amd64`.
- Para simular la rotura de E2 en local basta con editar la prueba y volver a correr el mismo comando: el job termina en `Job failed`.
- Los jobs `docker-build` y `deploy` publican en GHCR y necesitan `GITHUB_TOKEN`; no están pensados para act.

---

## 10. Despliegue en un servidor por SSH y rollback

### Preparación única del servidor (Ubuntu)

```bash
# 1. Docker + plugin compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER        # cerrar sesión y volver a entrar

# 2. Carpeta del despliegue
sudo mkdir -p /opt/hris/db && sudo chown $USER /opt/hris
# Copiar desde el repositorio:
#   deploy/docker-compose.yml -> /opt/hris/docker-compose.yml
#   db/init.sql               -> /opt/hris/db/init.sql
#   .env.example              -> /opt/hris/.env   (cambiar contraseñas, JWT_SECRET y HRIS_IMAGE)
```

En `/opt/hris/.env` pon `HRIS_IMAGE=ghcr.io/<owner-en-minúsculas>/hris-backend` y valores reales para `POSTGRES_PASSWORD` (el mismo en `DATABASE_URL`) y `JWT_SECRET` (por ejemplo `openssl rand -hex 32`).

```bash
# 3. Llave para GitHub Actions (en tu máquina)
ssh-keygen -t ed25519 -C "github-actions-hris" -f deploy_key -N ""
# deploy_key.pub -> agregar a ~/.ssh/authorized_keys del servidor
# deploy_key     -> pegar en el secreto SSH_PRIVATE_KEY
```

4. Crea los secretos `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY` (y `SSH_PORT` si no es 22) en el environment `staging` y/o `production`.

### Qué hace el pipeline en el servidor

1. `docker login ghcr.io` con el `GITHUB_TOKEN` temporal de la ejecución.
2. `docker compose pull api` y `docker compose up -d --remove-orphans` con `IMAGE_TAG=sha-<commit>`.
3. `curl --retry 10 http://localhost:3000/health`. **Si falla, vuelve automáticamente a la etiqueta de `.current_tag`** y el job termina en rojo.
4. Si responde: copia `.current_tag` a `.previous_tag`, guarda la etiqueta nueva en `.current_tag`, `docker image prune -f` y `docker logout`.

`init.sql` solo se ejecuta con el volumen vacío: el pipeline **nunca** ejecuta `docker compose down -v` en el servidor.

### Rollback manual

```bash
cd /opt/hris
IMAGE_TAG=$(cat .previous_tag) docker compose up -d api
```

Alternativas desde GitHub: *Re-run all jobs* sobre la ejecución del último commit sano (vuelve a desplegar su `sha-…`), o `git revert <commit> && git push` para que el pipeline despliegue de nuevo la versión anterior.

> El paquete de GHCR es privado por defecto. Para hacer `pull` en el servidor fuera del pipeline (por ejemplo en un rollback manual) inicia sesión con un token personal con `read:packages`, o cambia el paquete a público en *Package settings → Change visibility*.

---

## 11. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| La pestaña Actions del fork no muestra ejecuciones | los workflows están deshabilitados en forks | *Actions → I understand my workflows, go ahead and enable them* |
| `npm ci` falla con *lock file out of sync* | `package.json` cambió sin actualizar el lock | `cd backend && npm install` y subir `package-lock.json` |
| `denied: installation not allowed to Create organization package` o `403` al hacer push a GHCR | el token no tiene `packages: write` | revisar 5.1; en organizaciones, *Package settings → Manage Actions access* |
| `repository name must be lowercase` | owner con mayúsculas | el workflow ya lo convierte (`${GITHUB_REPOSITORY_OWNER,,}`); no cambies ese paso |
| El job *Deploy* queda en *Waiting* | `production` tiene *Required reviewers* | *Review deployments → Approve and deploy* |
| `Build & Unit Tests` no aparece al configurar la protección de rama | el check todavía no ha corrido | ejecuta el workflow una vez y vuelve a buscarlo |
| Prueba de humo: `API is not healthy` | la API no arrancó o la BD no respondió | ver el paso *Logs de los contenedores* (o `docker compose logs api`) |
| `bash: $'\r': command not found` al correr `smoke-test.sh` en Windows | el archivo se convirtió a CRLF | `.gitattributes` lo evita en clones nuevos; si no, `git rm --cached -r . && git reset --hard` |
| `port is already allocated` al levantar el ambiente local | otro proceso usa el puerto 3000 | `API_PORT=3001 docker compose up -d` y `bash deploy/smoke-test.sh http://localhost:3001` |
| Login del Administrador → 403 | el administrador no tiene `totp_secret` | es el comportamiento esperado (plan: no entra sin 2FA) |
| `verify-otp` → 401 `Verification code expired or was not requested` | pasaron más de 5 minutos desde el login, el código ya se usó o hubo 5 intentos fallidos | volver a hacer login y enviar un código nuevo |
| `verify-otp` → 401 `Invalid verification code` con un código correcto | reloj del equipo desfasado más de 30 s | sincronizar la hora (Windows: *Configuración → Hora → Sincronizar ahora*) |
| CN-15 devuelve 400 la segunda vez | ya hay una solicitud pendiente que consume el saldo | `docker compose down -v && docker compose up -d` |
| `docker compose up` falla con `env_file ... not found` usando `deploy/docker-compose.yml` | falta el `.env` junto al compose | crear `.env` desde `.env.example` en esa carpeta |

---

## 12. Decisiones tomadas ante ambigüedades del plan

| Tema | Decisión |
|---|---|
| Nombres de estado | La API usa `Pendiente`, `Aprobado` y `Rechazado` (los valores que envía el frontend en `decision`). El plan dice "Aprobada/Rechazada" refiriéndose a lo mismo. |
| Nombres de rol | `Administrador`, `Lider`, `Empleado` en el JWT y en la base de datos, como se pidió. El frontend original compara `user.rol` con `'admin'`, `'lider'` y `'empleado'`; como está fuera del alcance y se conserva sin cambios, su navegación por rol requeriría mapear esos nombres. |
| Días de vacaciones | Días hábiles de lunes a viernes, inclusive; no se descuentan festivos. Un rango sin días hábiles se rechaza con 400. |
| Saldo disponible | Saldo de la persona menos los días de sus solicitudes de vacaciones **pendientes** (así dos solicitudes no pueden comprometer el mismo saldo). El descuento real ocurre al aprobar, en una transacción. |
| Saldo insuficiente al aprobar | Si entre la solicitud y la aprobación el saldo bajó, aprobar devuelve 409. |
| Tipos de solicitud | `Vacaciones` (consume saldo) y `Ausencia` (no lo consume). |
| Edad mínima | 18 años (configurable con `EDAD_MINIMA`). Con 18 años cumplidos hoy el registro se acepta. Un nacido el 29 de febrero cumple años el 1 de marzo en años no bisiestos. |
| Formato de documento | Solo dígitos, de 6 a 10 (cédula colombiana). Teléfono: 10 dígitos. |
| Usuario de login | Se puede iniciar sesión con el nombre de usuario o con el correo. El usuario es la parte del correo antes de la `@` (misma regla del frontend). Si el texto contiene `@` se valida como correo (CN-03). |
| Reto 2FA | Se guarda en memoria del proceso (5 minutos, un solo uso, máximo 5 intentos). Con varias réplicas de la API habría que moverlo a la base de datos o a Redis. |
| Código 2FA inválido vs. mal formado | Faltan `personaId` o `codigo` → 400; cualquier código incorrecto (incluido uno no numérico) → 401, como pide CN-06. |
| `/health` | Responde 200 solo si también responde PostgreSQL (`SELECT 1`); si no, 503. Así el health check del despliegue detecta una base de datos caída. |
| Stack en errores | Nunca en producción. En desarrollo y pruebas, los errores 500 incluyen `stack` para depurar. |
| Quién edita empleados | Solo el Administrador, y solo `nombre`, `telefono`, `direccion`, `eps`, `arl`, `fondoPension`, `cesantias`, `diasVacaciones`, `liderId` y `estado`. Documento y correo no se cambian por esta ruta. |
| Contactos de emergencia | Cada persona agrega los suyos; el Administrador puede agregar a cualquiera; el Líder ve los de su equipo. |
| Auditoría | Se audita crear/actualizar empleados, crear contactos, crear solicitudes y aprobarlas/rechazarlas. Las semillas de `init.sql` y cualquier acción sin usuario no se registran. |
| Despliegue sin servidor | Si el environment no tiene `SSH_HOST`, el job *Deploy* despliega en el propio runner y ejecuta la prueba de humo, para que el pipeline completo se pueda evaluar sin infraestructura. |
| Prueba de humo y datos | `smoke-test.sh` crea un empleado de prueba en CN-08 (con documento y correo únicos por ejecución). Contra un servidor real usa `SMOKE_READONLY=1`. |
| Cobertura | Se mantienen las rutas del documento (`services`, `utils` y `middlewares` en `collectCoverageFrom`); el umbral aplica a `services` y `utils`, medido por carpeta. |
| Script `dev` | `node --watch src/server.js` en lugar de `nodemon` (Node 20 lo trae integrado; una dependencia menos). |
