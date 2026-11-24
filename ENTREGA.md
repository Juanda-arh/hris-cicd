# Entrega — Pipeline CI/CD del HRIS

**Ingeniería de Software III — Institución Universitaria EAM**

**Integrantes:** Hugo Alejandro Solorza – Juan David Buitrago

## Links

| Qué | Link |
|---|---|
| Repositorio público | https://github.com/Juanda-arh/hris-cicd |
| Guía de instalación y configuración | https://github.com/Juanda-arh/hris-cicd/blob/main/GUIA_INSTALACION.md |
| Pipeline (Actions) | https://github.com/Juanda-arh/hris-cicd/actions/workflows/ci-cd.yml |
| Ejecución en verde (`main`: pruebas → imagen → despliegue + prueba de humo) | https://github.com/Juanda-arh/hris-cicd/actions/runs/45472273241 |
| Ejecución con una prueba fallida (`demo/prueba-fallida`: PU-09 ❌, imagen y despliegue *skipped*) | https://github.com/Juanda-arh/hris-cicd/actions/runs/45472297628 |
| Imagen Docker en GHCR | https://github.com/users/Juanda-arh/packages/container/package/hris-backend |
| Trazabilidad PU → código → prueba | https://github.com/Juanda-arh/hris-cicd#trazabilidad-de-las-pruebas-unitarias |
| Video | _(agregar el link del video aquí)_ |

## Qué contiene

- **Aplicativo:** backend del HRIS en Node.js 20 + Express + PostgreSQL (`backend/`), con las 15 pruebas unitarias del plan (`backend/tests/unit/PU-01…PU-15`, Jest, cobertura ≥ 80 % en `src/services` y `src/utils`).
- **Pipeline:** `.github/workflows/ci-cd.yml`, con tres jobs encadenados: *Build & Unit Tests* → *Docker Build & Push* (GHCR) → *Deploy*. Si una prueba falla o la cobertura baja del umbral, los jobs siguientes no se ejecutan. Sin secretos configurados, el despliegue se hace en el propio runner y se valida con una prueba de humo (health + casos CN).
- **Guía:** `GUIA_INSTALACION.md`: requisitos, fork o clon, configuración de GitHub (Actions, permisos, environments, secretos opcionales), parámetros del pipeline, cómo leer los resultados, cómo romper pruebas a propósito y solución de problemas.
- **Guion del video:** `docs/GUION_VIDEO.md`.

## Texto para el comentario de la entrega

```
Integrantes: Hugo Alejandro Solorza – Juan David Buitrago

Repositorio (público): https://github.com/Juanda-arh/hris-cicd
Guía de instalación y configuración: https://github.com/Juanda-arh/hris-cicd/blob/main/GUIA_INSTALACION.md
Pipeline en verde: https://github.com/Juanda-arh/hris-cicd/actions/runs/45472273241
Pipeline con prueba fallida (PU-09): https://github.com/Juanda-arh/hris-cicd/actions/runs/45472297628
Video: <link del video>

Para evaluarlo: hacer fork (incluyendo develop), habilitar Actions en el fork y seguir la guía. Para romper una prueba, la sección 8 de la guía trae las ediciones exactas; el pipeline se detiene en "Build & Unit Tests" y no construye ni despliega.
```
