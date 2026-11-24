# Guion del video — Pipeline CI/CD del HRIS (8 a 10 minutos)

**Objetivo:** demostrar que cada push ejecuta las pruebas PU-01…PU-15, que el pipeline despliega solo cuando todo está en verde y que se detiene (y bloquea el merge) cuando una prueba falla.

## Links de la demostración

| Qué | Link |
|---|---|
| Repositorio (público) | https://github.com/Juanda-arh/hris-cicd |
| Actions | https://github.com/Juanda-arh/hris-cicd/actions |
| Ejecución en verde (`main`, 3 jobs ✓, prueba de humo 27/27) | https://github.com/Juanda-arh/hris-cicd/actions/runs/45472273241 |
| Ejecución fallida (`demo/prueba-fallida`, PU-09 ❌, Docker y Deploy *skipped*) | https://github.com/Juanda-arh/hris-cicd/actions/runs/45472297628 |
| Imagen en GHCR | https://github.com/users/Juanda-arh/packages/container/package/hris-backend |
| Rama de la demo | https://github.com/Juanda-arh/hris-cicd/tree/demo/prueba-fallida (ya trae PU-09 con `toBe(4)`) |

Si algo falla en vivo, estas dos ejecuciones sirven de respaldo: ábrelas y muestra lo mismo.

## Preparación (antes de grabar)

- [ ] Repositorio en GitHub con `main` y `develop`, Actions habilitado y al menos una ejecución previa en verde (para que el check `Build & Unit Tests` exista).
- [ ] Protección de `main` con el check **Build & Unit Tests** obligatorio (guía, 5.3).
- [ ] Environment `production` con *Required reviewers* (opcional, para mostrar la aprobación).
- [ ] Terminal en la raíz del repo, en `develop`, con `git pull` hecho y `cd backend && npm ci` ejecutado.
- [ ] Pestañas abiertas: repositorio (Code), Actions, Pull requests, Packages; editor con `backend/tests/unit/PU-09.diasVacaciones.test.js`.
- [ ] Fuente de la terminal y del navegador grande (zoom 125 %).

## Escenas

| Tiempo | Escena | En pantalla | Qué decir |
|---|---|---|---|
| 0:00 – 0:45 | **1. Introducción** | README: diagrama del flujo | "Este es el backend del HRIS de M&S Mechanical. Cada push a `develop` o `main` dispara un pipeline de tres jobs: pruebas, imagen y despliegue. El job de pruebas es la única puerta: si falla una prueba o la cobertura baja del 80 %, no se despliega nada." |
| 0:45 – 1:45 | **2. El repositorio** | Árbol: `.github/workflows/ci-cd.yml`, `backend/tests/unit/` (15 archivos), `jest.config.js` (umbral), `db/init.sql`, `deploy/` | "Hay un archivo de prueba por caso del plan, PU-01 a PU-15, y cada uno copia en su cabecera el resultado esperado del plan. El umbral de cobertura está en `jest.config.js`: 80 % de líneas en servicios y utilidades." Abrir `PU-10` y señalar el `jest.mock` del repositorio: "las pruebas no usan base de datos". |
| 1:45 – 2:30 | **3. Pruebas en local** | `npm run test:ci` en la terminal | "Antes de subir nada, el mismo comando del pipeline corre en local: 15 suites, 161 pruebas, en unos segundos." Mostrar `Test Suites: 15 passed` y `node scripts/ci-summary.js`. |
| 2:30 – 4:00 | **4. Pipeline en verde (E1)** | `git commit --allow-empty -m "ci: demo pipeline en verde" && git push` en `develop` → Actions | Mostrar el grafo de tres jobs. Abrir *Build & Unit Tests* → paso de pruebas (✓ por cada PU) y *Tabla de cobertura por archivo*. Volver al **Summary**: tabla PU-01…PU-15 y cobertura por capa. "Las pruebas pasaron, así que se construyó la imagen…" → *Packages*: etiquetas `develop` y `sha-…`. "…y se desplegó." → job *Deploy*: paso *Prueba de humo* con los casos CN-01, 02, 03, 04, 07, 08, 12, 13 y 19 en ✓, y el resumen del despliegue. |
| 4:00 – 5:45 | **5. Rompemos una prueba (E2)** | `git checkout demo/prueba-fallida`; editor: `PU-09…test.js`, línea 12, muestra `toBe(4)`; `gh workflow run ci-cd.yml --ref demo/prueba-fallida` | "Simulemos un error en una rama aparte, sin tocar `develop` ni `main`: decimos que de lunes a viernes hay 4 días hábiles." En Actions: *Build & Unit Tests* en rojo; **Docker Build & Push y Deploy en *skipped***. Abrir el log: `✕ de lunes a viernes…`, `Expected: 4 / Received: 5`. Summary: PU-09 ❌ y *Failed tests*. "La imagen no se construyó y el ambiente sigue con la versión anterior." Mostrar en *Packages* que no hay etiqueta nueva. |
| 5:45 – 7:15 | **6. PR bloqueado (E3)** | `gh pr create --base main --head demo/prueba-fallida --title "Demo: PR con prueba fallida" --body "Demo pipeline E3"` | "Ahora intento llevar este código a producción." En el PR: solo corre *Build & Unit Tests*, falla, y aparece *Merging is blocked* / *Required status check "Build & Unit Tests" is failing*. "Este es el criterio de rechazo del plan aplicado automáticamente: si una PU falla, no se fusiona." |
| 7:15 – 8:30 | **7. Revert y vuelta a verde** | `git revert HEAD --no-edit && git push` (en `demo/prueba-fallida`) | "Corregimos revirtiendo el commit." El check del PR se vuelve a ejecutar y queda en verde; el botón *Merge* se habilita. Cierra el PR sin fusionar (`gh pr close`): era solo la demo. |
| 8:30 – 9:30 | **8. (Opcional) Cobertura** | `cp docs/ejemplos/sinPruebas.js backend/src/utils/ && cd backend && npm run test:ci` | "Aunque las 161 pruebas pasen, si se agrega código sin pruebas Jest falla": `coverage threshold for lines (80%) not met: 76.22%`. Borrar el archivo. |
| 9:30 – 10:00 | **9. Cierre** | README: tabla "Cómo se aplican los criterios del plan" | "Las pruebas ya no dependen de que alguien recuerde correrlas; el 100 % de PU en verde y la cobertura ≥ 80 % son reglas que bloquean el despliegue, y cada versión desplegada se identifica por el SHA de su commit, lo que permite volver atrás con un comando." |

## Comandos de la grabación, en orden

Teclea estos comandos en **Git Bash**, desde la raíz del repositorio.

```bash
# Escena 3: pruebas en local
git checkout develop && git pull
cd backend && npm ci && npm run test:ci; node scripts/ci-summary.js; cd ..

# Escena 4 (E1): pipeline en verde
git commit --allow-empty -m "ci: demo pipeline en verde" && git push
gh run watch                       # elige la ejecución de develop

# Escena 5 (E2): prueba rota en la rama de la demo (ya tiene toBe(4))
git checkout demo/prueba-fallida && git pull
grep -n "toBe(4)" backend/tests/unit/PU-09.diasVacaciones.test.js
gh workflow run ci-cd.yml --ref demo/prueba-fallida
gh run watch                       # elige la ejecución de demo/prueba-fallida

# Escena 6 (E3): PR bloqueado
gh pr create --base main --head demo/prueba-fallida --title "Demo: PR con prueba fallida" --body "Demo pipeline E3"

# Escena 7: corregir y ver el check en verde
git revert HEAD --no-edit && git push
gh pr checks --watch
gh pr close demo/prueba-fallida    # sin fusionar

# Escena 8 (opcional, solo local)
git checkout develop
cp docs/ejemplos/sinPruebas.js backend/src/utils/sinPruebas.js
(cd backend && npm run test:ci); echo "exit=$?"
rm backend/src/utils/sinPruebas.js
```

> Para repetir la demo después de la escena 7, vuelve a romper la prueba en la rama: `git checkout demo/prueba-fallida && git revert HEAD --no-edit && git push` (revierte el revert y PU-09 vuelve a quedar con `toBe(4)`).

## Consejos

- Mientras un job corre (1–2 min), explica el YAML del workflow en el editor: `needs`, `if: github.event_name != 'pull_request'` y el `environment` por rama.
- Si el job *Deploy* pide aprobación, explica que es el *Required reviewers* del environment `production`.
- Al terminar, deja `develop` en verde y cierra el PR de la demo sin fusionarlo.
