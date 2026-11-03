# Release de Forward Mobile

Este documento describe cómo se verifica, se publica y se versiona la app: la integración continua (CI), las actualizaciones por aire (OTA), la construcción del APK y la numeración de versiones. Las secciones de OTA, build y versión se completan en las siguientes tareas de la tanda 4; hoy está escrita la sección de CI.

## CI

En cada pull request hacia `main` y en cada push a `main`, GitHub Actions ejecuta el job `check` (archivo `.github/workflows/ci.yml`) con Node 24 y estos pasos, en este orden:

1. `npm ci`: instala exactamente lo que dice `package-lock.json`.
2. `npm run lint`: ejecuta `tsc --noEmit` (chequeo de tipos).
3. `npm test -- --ci`: ejecuta la suite de jest.

Un push nuevo a la misma pull request cancela la corrida anterior. El job tiene un límite de 25 minutos.

### Dónde verlo

- En la pestaña "Checks" de la pull request, o al pie de la pull request como el check `check`.
- En la pestaña "Actions" del repositorio, para las corridas de `main`.

### Si el check está en rojo

La pull request no se mergea. Para ver qué test falló, abrir la corrida y descargar el artefacto `junit` (el `junit.xml` de jest), que se conserva 7 días y se sube también cuando la corrida falla.

### Paso único del dueño del repositorio

Para que GitHub impida mergear con el check en rojo: Settings → Branches → regla para `main` → "Require status checks to pass" → seleccionar `check`. Los agentes no pueden modificar la protección de rama.

### Equivalente local

Para trabajar sin esperar a CI:

```
npm run lint && npm test
```

`npm test` reescribe `junit.xml`, que está versionado: descartar ese cambio antes de commitear (`git checkout -- junit.xml`).

## Actualizaciones OTA

Pendiente: tanda 4, T2/T3.

## Build del APK

Pendiente: tanda 4, T2/T3.

## Versión

Pendiente: tanda 4, T2/T3.
