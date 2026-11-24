# Guion del video — Pipeline CI/CD del HRIS (8 a 10 minutos)

**Objetivo:** demostrar que cada push ejecuta las pruebas PU-01…PU-15, que el pipeline despliega solo cuando todo está en verde y que se detiene (y bloquea el merge) cuando una prueba falla.

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
| 2:30 – 4:00 | **4. Pipeline en verde (E1)** | `git commit --allow-empty -m "ci: demo" && git push` → Actions | Mostrar el grafo de tres jobs. Abrir *Build & Unit Tests* → paso de pruebas (✓ por cada PU) y *Tabla de cobertura por archivo*. Volver al **Summary**: tabla PU-01…PU-15 y cobertura por capa. "Las pruebas pasaron, así que se construyó la imagen…" → *Packages*: etiquetas `develop` y `sha-…`. "…y se desplegó." → job *Deploy*: paso *Prueba de humo* con los casos CN-01, 02, 03, 04, 07, 08, 12, 13 y 19 en ✓, y el resumen del despliegue. |
| 4:00 – 5:45 | **5. Rompemos una prueba (E2)** | Editor: `PU-09…test.js`, línea 12, `toBe(5)` → `toBe(4)`; commit y push | "Simulemos un error: decimos que de lunes a viernes hay 4 días hábiles." En Actions: *Build & Unit Tests* en rojo; **Docker Build & Push y Deploy en *skipped***. Abrir el log: `✕ de lunes a viernes…`, `Expected: 4 / Received: 5`. Summary: PU-09 ❌ y *Failed tests*. "La imagen no se construyó y el ambiente sigue con la versión anterior." Mostrar en *Packages* que no hay etiqueta nueva. |
| 5:45 – 7:15 | **6. PR bloqueado (E3)** | `gh pr create --base main --head develop --title "Release" --body "Demo"` o desde la web | "Ahora intento llevar este código a producción." En el PR: solo corre *Build & Unit Tests*, falla, y aparece *Merging is blocked* / *Required status check "Build & Unit Tests" is failing*. "Este es el criterio de rechazo del plan aplicado automáticamente: si una PU falla, no se fusiona." |
| 7:15 – 8:30 | **7. Revert y vuelta a verde** | `git revert HEAD --no-edit && git push` | "Corregimos revirtiendo el commit." El check del PR se vuelve a ejecutar y queda en verde; el botón *Merge* se habilita. En `develop` el pipeline completo vuelve a desplegar. (Opcional: fusionar el PR y mostrar el job *Deploy* esperando aprobación en `production`.) |
| 8:30 – 9:30 | **8. (Opcional) Cobertura** | `cp docs/ejemplos/sinPruebas.js backend/src/utils/ && cd backend && npm run test:ci` | "Aunque las 161 pruebas pasen, si se agrega código sin pruebas Jest falla": `coverage threshold for lines (80%) not met: 76.22%`. Borrar el archivo. |
| 9:30 – 10:00 | **9. Cierre** | README: tabla "Cómo se aplican los criterios del plan" | "Las pruebas ya no dependen de que alguien recuerde correrlas; el 100 % de PU en verde y la cobertura ≥ 80 % son reglas que bloquean el despliegue, y cada versión desplegada se identifica por el SHA de su commit, lo que permite volver atrás con un comando." |

## Comandos de la grabación, en orden

```bash
# Escena 3
cd backend && npm run test:ci && node scripts/ci-summary.js && cd ..

# Escena 4 (E1)
git checkout develop
git commit --allow-empty -m "ci: demo pipeline en verde" && git push

# Escena 5 (E2)
sed -i "s/'2027-03-05')).toBe(5)/'2027-03-05')).toBe(4)/" backend/tests/unit/PU-09.diasVacaciones.test.js
git commit -am "test: romper PU-09 a propósito" && git push

# Escena 6 (E3)
gh pr create --base main --head develop --title "Release" --body "Demo pipeline E3"

# Escena 7
git revert HEAD --no-edit && git push

# Escena 8 (opcional, solo local)
cp docs/ejemplos/sinPruebas.js backend/src/utils/sinPruebas.js
(cd backend && npm run test:ci); echo "exit=$?"
rm backend/src/utils/sinPruebas.js
```

## Consejos

- Mientras un job corre (1–2 min), explica el YAML del workflow en el editor: `needs`, `if: github.event_name != 'pull_request'` y el `environment` por rama.
- Si el job *Deploy* pide aprobación, explica que es el *Required reviewers* del environment `production`.
- Al terminar, deja `develop` en verde y cierra (o fusiona) el PR de la demo.
