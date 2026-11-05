import * as Location from 'expo-location'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { logger } from '@/core/utils/logger'
import { storage } from '@/core/utils/storage'
import { encolarPosiciones, type PosicionEnCola } from './colaPosiciones'
import { enviarPosicionesPendientes, type ResultadoEnvioPosiciones } from './enviarPosiciones'

/**
 * GPS del viaje (S5): una lectura por minuto mientras el viaje está en curso, en un servicio con notificación de
 * Android. Nada de acá frena el viaje: sin permiso o con una falla del módulo nativo, el chofer trabaja igual y la web
 * muestra "sin señal".
 *
 * El servicio con notificación no necesita ACCESS_BACKGROUND_LOCATION (`LocationModule.kt`, startLocationUpdatesAsync):
 * alcanza con el permiso "mientras se usa la app", pero hay que arrancarlo con la app en primer plano.
 */
export const TAREA_GPS = 'forward-gps-viaje'

const INTERVALO_MS = 60_000
const CLAVE_ACTIVO = 'gps-viaje:activo'
const claveSinRegistro = (usuarioId: string) => `gps-viaje:sin-registro:${usuarioId}`

/** `omitido`: este viaje ya no se registra (terminó, el servidor lo cerró o el chofer dijo "Ahora no"). */
export type ResultadoRegistro = 'registrando' | 'preguntar' | 'sinPermiso' | 'omitido'

interface ViajeActivo {
  hojaDeRutaId: string
  usuarioId: string
}

function leerActivo(): ViajeActivo | null {
  try {
    const v = JSON.parse(storage.getString(CLAVE_ACTIVO) ?? 'null') as Partial<ViajeActivo> | null
    return v?.hojaDeRutaId && v.usuarioId ? { hojaDeRutaId: v.hojaDeRutaId, usuarioId: v.usuarioId } : null
  } catch {
    return null
  }
}

const seOmite = (hojaDeRutaId: string, usuarioId: string) => storage.getString(claveSinRegistro(usuarioId)) === hojaDeRutaId
const omitir = (hojaDeRutaId: string, usuarioId: string) => storage.set(claveSinRegistro(usuarioId), hojaDeRutaId)

async function frenarTarea(): Promise<void> {
  storage.remove(CLAVE_ACTIVO)
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_GPS)) await Location.stopLocationUpdatesAsync(TAREA_GPS)
  } catch (e) {
    logger.warn('No se pudo frenar el GPS del viaje', e)
  }
}

async function arrancarTarea(hojaDeRutaId: string, usuarioId: string): Promise<ResultadoRegistro> {
  // Antes de arrancar: la primera lectura ya tiene que saber de qué viaje es.
  storage.set(CLAVE_ACTIVO, JSON.stringify({ hojaDeRutaId, usuarioId } satisfies ViajeActivo))
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_GPS)) return 'registrando'
    await Location.startLocationUpdatesAsync(TAREA_GPS, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: INTERVALO_MS,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Forward está registrando el viaje',
        notificationBody: 'La oficina ve por dónde va el recorrido.',
      },
    })
    return 'registrando'
  } catch (e) {
    storage.remove(CLAVE_ACTIVO)
    logger.warn('No se pudo arrancar el GPS del viaje', e)
    return 'sinPermiso'
  }
}

async function evaluar(hojaDeRutaId: string, usuarioId: string): Promise<ResultadoRegistro> {
  if (seOmite(hojaDeRutaId, usuarioId)) return 'omitido'
  try {
    const permiso = await Location.getForegroundPermissionsAsync()
    if (permiso.granted) return await arrancarTarea(hojaDeRutaId, usuarioId)
    return permiso.canAskAgain ? 'preguntar' : 'sinPermiso'
  } catch (e) {
    logger.warn('No se pudo leer el permiso de ubicación', e)
    return 'sinPermiso'
  }
}

let comenzando: Promise<ResultadoRegistro> | null = null

/**
 * Al iniciar el recorrido, y cada vez que la consola muestra un viaje en curso del chofer (un reinicio del teléfono o
 * volver a entrar lo había frenado). No pide nada al sistema: si falta preguntar, devuelve `preguntar`.
 */
export function comenzarRegistroGps(hojaDeRutaId: string, usuarioId: string): Promise<ResultadoRegistro> {
  comenzando ??= evaluar(hojaDeRutaId, usuarioId).finally(() => { comenzando = null })
  return comenzando
}

/** El chofer leyó la explicación y aceptó: recién ahora sale el pedido del sistema. */
export async function aceptarPermisoGps(hojaDeRutaId: string, usuarioId: string): Promise<ResultadoRegistro> {
  try {
    const permiso = await Location.requestForegroundPermissionsAsync()
    if (permiso.granted) return await arrancarTarea(hojaDeRutaId, usuarioId)
  } catch (e) {
    logger.warn('No se pudo pedir el permiso de ubicación', e)
  }
  omitir(hojaDeRutaId, usuarioId)
  return 'sinPermiso'
}

/** "Ahora no": este viaje sigue sin ubicación y no se vuelve a preguntar. */
export const rechazarPermisoGps = (hojaDeRutaId: string, usuarioId: string): void => omitir(hojaDeRutaId, usuarioId)

const alCerrarViaje = (usuarioId: string) => (hojaDeRutaId: string) => {
  omitir(hojaDeRutaId, usuarioId)
  if (leerActivo()?.hojaDeRutaId === hojaDeRutaId) void frenarTarea()
}

/** Manda lo que espera; si el servidor da por cerrado un viaje, frena su registro y descarta su cola. */
export const enviarPosiciones = (usuarioId: string): Promise<ResultadoEnvioPosiciones> =>
  enviarPosicionesPendientes(usuarioId, alCerrarViaje(usuarioId))

/** El viaje finalizó: frena y sube lo que quedó (el servidor lo acepta hasta la hora de llegada). Nunca falla. */
export async function terminarRegistroGps(hojaDeRutaId: string, usuarioId: string): Promise<void> {
  omitir(hojaDeRutaId, usuarioId)
  if (leerActivo()?.hojaDeRutaId === hojaDeRutaId) await frenarTarea()
  try {
    await enviarPosiciones(usuarioId)
  } catch (e) {
    logger.warn('No se pudieron mandar las posiciones del viaje', e)
  }
}

const redondeado = (n: number) => Math.round(n * 10) / 10

/** Una lectura como la pide el contrato; null si el servidor rechazaría todo el lote por ella. iOS manda -1 sin dato. */
function aPosicion(hojaDeRutaId: string, { coords, timestamp }: Location.LocationObject): PosicionEnCola | null {
  const { latitude: latitud, longitude: longitud, accuracy, speed } = coords
  if (!(Math.abs(latitud) <= 90) || !(Math.abs(longitud) <= 180) || !Number.isFinite(timestamp)) return null
  return {
    hojaDeRutaId,
    latitud,
    longitud,
    ...(accuracy != null && accuracy >= 0 ? { precisionMetros: redondeado(accuracy) } : {}),
    ...(speed != null && speed >= 0 ? { velocidadKmh: redondeado(speed * 3.6) } : {}),
    registradaEn: new Date(timestamp).toISOString(),
  }
}

async function alRecibirLecturas({ data, error }: { data?: { locations?: Location.LocationObject[] }; error: { message: string } | null }): Promise<void> {
  try {
    if (error) {
      logger.warn('El GPS del viaje informó una falla', error.message)
      return
    }
    const activo = leerActivo()
    if (!activo || useAuthStore.getState().user?.id !== activo.usuarioId) {
      await frenarTarea()
      return
    }
    const posiciones = (data?.locations ?? []).map((l) => aPosicion(activo.hojaDeRutaId, l)).filter((p): p is PosicionEnCola => p !== null)
    encolarPosiciones(activo.usuarioId, posiciones)
    await enviarPosiciones(activo.usuarioId)
  } catch (e) {
    logger.warn('No se pudo guardar la lectura del GPS', e)
  }
}

/*
 * Android y iOS exigen la definición al cargar el bundle, no dentro de un componente: si una lectura encuentra la
 * tarea sin definir, expo-task-manager la da de baja. Por eso este módulo se carga desde `app/_layout`
 * (`EnvioConsolaSinSenal`). Nunca se escriben coordenadas en el log.
 *
 * `require` con try: importar expo-task-manager en un binario sin su módulo nativo tira error al cargar, y desde
 * `app/_layout` eso sería no abrir la app. Sin la tarea, `startLocationUpdatesAsync` falla y el viaje sigue sin ubicación.
 */
try {
  const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager')
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TAREA_GPS, alRecibirLecturas)
} catch (e) {
  logger.warn('El GPS del viaje no está disponible en esta versión de la app', e)
}

// Cualquier cierre de sesión (manual o forzado) frena el registro; la cola queda, como las otras colas por usuario.
useAuthStore.subscribe((estado, antes) => {
  if (antes.isAuthenticated && !estado.isAuthenticated) void frenarTarea()
})
