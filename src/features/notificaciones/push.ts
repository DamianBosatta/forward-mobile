import { Platform } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { eliminarDispositivoPush, registrarDispositivoPush } from '@/libs/api-client/notificaciones'
import type { AccionSugerida } from './avisos'

/**
 * Push de avisos (9B, T9). El servidor manda por Expo cada aviso nuevo del usuario a los celulares
 * que registró; acá se pide el permiso, se registra el token al iniciar sesión (y al abrir la app
 * con sesión) y se da de baja al cerrarla. Todo es "mejor esfuerzo": un simulador, Expo Go, el
 * permiso negado, un build sin `projectId` o un servidor sin el endpoint dejan la app sin push,
 * sin error para el usuario y sin ruido en Sentry. La bandeja sigue funcionando igual.
 */

/** Canal de Android de los avisos: sin un canal creado, Android 13+ ni siquiera pide el permiso. */
export const CANAL_AVISOS = 'default'

let tokenRegistrado: string | null = null
let bajaEnviada = false

/** Solo para los tests: el estado del módulo vuelve a cero. */
export function reiniciarEstadoPush(): void {
  tokenRegistrado = null
  bajaEnviada = false
}

/** El `projectId` de EAS con el que Expo emite el token, o `null` si el build no lo trae. */
export function projectIdDeEas(): string | null {
  const id = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  return typeof id === 'string' && id ? id : null
}

/**
 * El token de Expo de este celular, o `null` si no puede recibir push. Nunca tira. Con
 * `pedirPermiso: false` no muestra el diálogo (para la baja: si no hay permiso, no hay token).
 */
export async function tokenDePush({ pedirPermiso }: { pedirPermiso: boolean }): Promise<string | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null
  // Expo Go no recibe push remotos de este proyecto.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null
  const projectId = projectIdDeEas()
  if (!projectId) return null
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL_AVISOS, {
        name: 'Avisos',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }
    let { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted' && pedirPermiso) ({ status } = await Notifications.requestPermissionsAsync())
    if (status !== 'granted') return null
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data
  } catch {
    // Un simulador sin servicios de push o sin red para pedir el token: la app sigue sin push.
    return null
  }
}

/** Pide el permiso (la primera vez) y registra el token en el servidor. Nunca tira. */
export async function registrarPush(): Promise<void> {
  const token = await tokenDePush({ pedirPermiso: true })
  if (!token) return
  bajaEnviada = false
  try {
    await registrarDispositivoPush({ token, plataforma: Platform.OS })
    tokenRegistrado = token
  } catch {
    // Servidor sin el endpoint (estado esperado, no se registra como error) o sin red: se vuelve a
    // intentar en el próximo inicio con sesión.
  }
}

/**
 * Da de baja el token de este celular con la sesión `accessToken`, que puede ser la que se está
 * cerrando (el store ya la borró). Nunca tira. Si la sesión ya se revocó en el servidor, el DELETE
 * vuelve 401 y el token queda hasta que otro usuario lo registre o Expo lo dé por muerto.
 */
export async function darDeBajaPush(accessToken: string | null): Promise<void> {
  if (bajaEnviada || !accessToken) return
  const token = tokenRegistrado ?? (await tokenDePush({ pedirPermiso: false }))
  if (!token) return
  try {
    await eliminarDispositivoPush(token, accessToken)
    tokenRegistrado = null
    bajaEnviada = true
  } catch {
    // Mejor esfuerzo: cerrar la sesión no espera ni depende de esto.
  }
}

/**
 * La baja antes de cerrar la sesión en el servidor: mientras el token de acceso todavía vale. La
 * llama quien cierra la sesión, antes de revocarla.
 */
export function darDeBajaPushAntesDeSalir(): Promise<void> {
  return darDeBajaPush(useAuthStore.getState().accessToken)
}

/**
 * Al cerrarse la sesión por cualquier camino, intenta la baja con la sesión que se cerró (misma
 * suscripción que `vaciarCacheAlCerrarSesion`). Devuelve la función para dejar de escuchar.
 */
export function bajaDePushAlCerrarSesion(): () => void {
  return useAuthStore.subscribe((estado, antes) => {
    if (antes.isAuthenticated && !estado.isAuthenticated) void darDeBajaPush(antes.accessToken)
  })
}

/** Lo que el servidor manda en `data` de cada push. */
export interface DatosPush {
  notificacionId: string
  accion: AccionSugerida | null
}

/** Lee `data` de un push del servidor; `null` si no tiene la forma esperada (otro emisor, versión vieja). */
export function leerDatosPush(data: unknown): DatosPush | null {
  if (!data || typeof data !== 'object') return null
  const { notificacionId, accion } = data as Record<string, unknown>
  if (typeof notificacionId !== 'string' || !notificacionId) return null
  const a = accion as Record<string, unknown> | null | undefined
  const accionValida = a && typeof a === 'object' && typeof a.destino === 'string' && typeof a.etiqueta === 'string'
  return {
    notificacionId,
    accion: accionValida
      ? { destino: a.destino as AccionSugerida['destino'], etiqueta: a.etiqueta as string, entidadId: typeof a.entidadId === 'string' ? a.entidadId : null }
      : null,
  }
}
