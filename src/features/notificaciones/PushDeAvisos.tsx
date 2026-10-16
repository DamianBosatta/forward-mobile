import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { notificacionesKeys, useMarcarAvisosLeidos } from '@/libs/api-client/notificaciones'
import { rutaAlTocarAviso } from './bandeja'
import { bajaDePushAlCerrarSesion, leerDatosPush, registrarPush } from './push'

/** La bandeja: adonde lleva un push sin pantalla propia en mobile (o sin datos del servidor). */
export const RUTA_BANDEJA = '/avisos'

/**
 * Montado una vez en la raíz. Registra el celular para push al iniciar sesión (y al abrir la app
 * con sesión), intenta la baja al cerrarla, muestra los push que llegan con la app abierta
 * (refrescando el badge) y, al tocar uno, hace lo mismo que tocar el aviso en la bandeja: lo marca
 * leído y lleva a la pantalla de su acción, o a la bandeja si mobile no la tiene.
 */
export function PushDeAvisos() {
  const autenticado = useAuthStore((s) => s.isAuthenticated && !!s.accessToken)
  const router = useRouter()
  const qc = useQueryClient()
  const { mutate: marcarLeidos } = useMarcarAvisosLeidos()
  const atendidos = useRef(new Set<string>())

  useEffect(() => {
    if (autenticado) void registrarPush()
  }, [autenticado])

  useEffect(() => bajaDePushAlCerrarSesion(), [])

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })
    const sub = Notifications.addNotificationReceivedListener(() => {
      void qc.invalidateQueries({ queryKey: notificacionesKeys.all })
    })
    return () => sub.remove()
  }, [qc])

  const abrir = useCallback((respuesta: Notifications.NotificationResponse) => {
    // El push que abrió la app llega por getLastNotificationResponseAsync y a veces también por el
    // listener: se atiende una sola vez.
    const id = respuesta.notification.request.identifier
    if (atendidos.current.has(id)) return
    atendidos.current.add(id)

    const datos = leerDatosPush(respuesta.notification.request.content.data)
    if (datos) marcarLeidos([datos.notificacionId])
    router.push((rutaAlTocarAviso(datos?.accion) ?? RUTA_BANDEJA) as never)
  }, [marcarLeidos, router])

  useEffect(() => {
    // Sin sesión no hay adónde llevar: el push se ignora (la bandeja lo muestra al volver a entrar).
    if (!autenticado) return
    const sub = Notifications.addNotificationResponseReceivedListener(abrir)
    void Notifications.getLastNotificationResponseAsync().then((ultima) => {
      if (!ultima) return
      abrir(ultima)
      void Notifications.clearLastNotificationResponseAsync()
    }).catch(() => {})
    return () => sub.remove()
  }, [autenticado, abrir])

  return null
}
