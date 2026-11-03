# Release de Forward Mobile

Este documento describe cómo se verifica, se publica y se versiona la app: la integración continua (CI), las actualizaciones por aire (OTA), la construcción del APK y la numeración de versiones. La sección de build del APK se completa en la siguiente tarea de la tanda 4; hoy están escritas las secciones de CI, actualizaciones OTA y versión.

## CI

En cada pull request hacia `main` y en cada push a `main`, GitHub Actions ejecuta el job `check` (archivo `.github/workflows/ci.yml`) con Node 24 y estos pasos, en este orden:

1. `npm ci`: instala exactamente lo que dice `package-lock.json`.
2. `npm run lint`: ejecuta `tsc --noEmit` (chequeo de tipos).
3. `npm test -- --ci`: ejecuta la suite de jest.

Un push nuevo a la misma pull request cancela la corrida anterior. El job tiene un límite de 25 minutos.

### Dónde verlo

- En la pestaña "Checks" de la pull request, o al pie de la pull request como el check `check`.
- En la pestaña "Actions" del repositorio, para las corridas de `main`.

Los tests corren en tres husos horarios (UTC, Argentina y Tokio) porque un error de fechas puede ser invisible en un solo huso; los checks requeridos son las tres entradas `check`.

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

La app usa EAS Update (`expo-updates`): un cambio que es solo JavaScript, estilos o imágenes llega a los teléfonos sin instalar un APK nuevo. La app descarga la actualización en segundo plano al abrirse y la aplica la próxima vez que se abre (puede hacer falta cerrarla del todo y volver a abrirla hasta dos veces).

### Qué puede cambiar una actualización y qué no

- **Puede:** pantallas, textos, lógica en TypeScript, estilos, imágenes y otros archivos que viajan dentro del bundle.
- **No puede:** agregar o actualizar una dependencia con código nativo (por ejemplo un paquete `expo-*` nuevo), cambiar permisos, el ícono, el splash, `android.package`, plugins de `app.config.ts` ni la versión del SDK de Expo. Eso exige un build nativo nuevo.

### Reglas

- Un cambio de dependencia nativa siempre implica un build nativo nuevo antes de cualquier actualización.
- El primer build `preview` y el primer build `production` después de esta tanda son builds nativos nuevos: los APK anteriores no traen `expo-updates` y no reciben actualizaciones.

Motivo: el 2026-11-02 el dev client instalado en el emulador se cerró al abrir con "Cannot find native module 'ExpoCrypto'", porque `expo-crypto` entró en #170 y ese build era anterior. Una actualización OTA sobre un build así lo rompería de la misma forma.

### Cómo protege `fingerprint` a los builds viejos

`app.config.ts` define `runtimeVersion: { policy: 'fingerprint' }`. La versión de runtime es una huella calculada sobre la parte nativa del proyecto (dependencias nativas, plugins y configuración nativa). Cada build lleva su huella y solo recibe actualizaciones publicadas con la misma huella. Si un cambio toca algo nativo, la huella cambia y la actualización queda para los builds nuevos: los teléfonos con el build viejo la ignoran en lugar de romperse. Por eso un cambio nativo sin build nuevo no rompe a nadie, pero tampoco le llega a nadie hasta que se instala el build nuevo.

### Canales

| Canal | Builds que lo escuchan | API |
| --- | --- | --- |
| `preview` | perfil `preview` de `eas.json` | producción |
| `production` | perfil `production` de `eas.json` | producción |

Los dos canales apuntan a la API de producción (no hay entorno de staging). El perfil `development` no tiene canal.

### Publicación automática en cada merge a `main`

El job `publish-update` de `.github/workflows/ci.yml` corre en cada push a `main`, después de que el job `check` termina en verde, y publica en el canal `production`:

```
eas update --channel production --environment production --message "<mensaje del commit>" --non-interactive
```

Antes de publicar carga las variables `EXPO_PUBLIC_*` del perfil `production` de `eas.json` (URL de la API, de SignalR y Sentry), porque `eas update` no lee el `env` de los perfiles de build. Si en el futuro se crean variables de entorno en EAS (expo.dev → proyecto → Environment variables, entorno `production`) con el mismo nombre, esas tienen prioridad.

Mientras no exista el secreto `EXPO_TOKEN`, el job termina en verde con el aviso "EXPO_TOKEN is not set: no update was published" y no publica nada.

### Paso único del dueño: crear `EXPO_TOKEN`

1. En expo.dev → Account settings → Access tokens, crear un token (por ejemplo "github-actions-forward-mobile").
2. Guardarlo como secreto del repositorio, escribiéndolo cuando el comando lo pida:

```
gh secret set EXPO_TOKEN --repo DamianBosatta/forward-mobile
```

El token lo crea y lo pega el dueño; los agentes no lo leen ni lo manejan. Para revocarlo, borrarlo en Access tokens y con `gh secret delete EXPO_TOKEN --repo DamianBosatta/forward-mobile`.

### Publicar a mano

Para probar un cambio en un build `preview` antes de mergearlo, desde la rama y con sesión iniciada en `eas` (`eas login`):

```
eas update --channel preview --message "..."
```

`eas update` no lee el `env` de `eas.json`: antes de publicar, definir en la terminal las variables de `build.preview.env` (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SIGNALR_URL`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_ENVIRONMENT`). Sin ellas la app igual usa la API de producción, que es su valor por defecto, pero el bundle sale sin Sentry.

### Revertir una actualización

Dos caminos, según la documentación de Expo (https://docs.expo.dev/eas-update/rollbacks/):

- Volver a publicar la actualización anterior: buscar su grupo en expo.dev → proyecto → Updates (o con `eas update:list --branch production`) y correr `eas update:republish --group <id-anterior>`.
- Usar el asistente `eas update:rollback`, que permite volver a una actualización anterior o al bundle que vino dentro del build.

## Build del APK

Pendiente: tanda 4, T3.

## Versión

La app tiene dos números:

- **Versión** (`version` en `app.config.ts`, hoy `1.0.0`): la que ve la gente. Se sube a mano en cada release, en un commit propio, antes del build: `1.0.1` para correcciones, `1.1.0` para funciones nuevas.
- **Build** (`versionCode` de Android): lo pone EAS. `eas.json` usa `cli.appVersionSource: "remote"` y `autoIncrement: true` en los perfiles `preview` y `production`, así que cada build suma uno al número guardado en EAS. No se edita a mano ni vive en el repositorio.

Cambiar la versión en `app.config.ts` cambia la huella de runtime: los builds anteriores dejan de recibir las actualizaciones que se publiquen después, y hace falta un build nuevo.

### Dónde verlas en la app

Al pie de "Mi cuenta":

- `Forward Mobile 1.0.0 (build 12) · conectado a producción`: versión y build.
- `Actualización a1b2c3d4 del 02/11/2026`: solo cuando corre una actualización OTA; muestra los primeros 8 caracteres de su id (el mismo que figura en expo.dev → Updates) y el día en que se publicó, en hora de Argentina.

En Expo Go o en el dev client puede faltar el build y no aparece la línea de actualización.
