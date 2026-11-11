import React from 'react'
import { View } from 'react-native'
import { usePathname } from 'expo-router'
import { useNetworkStatus } from '@/core/utils/useNetworkStatus'
import { AvisoSinConexionContext } from './fw/TopBar'

/**
 * Pantallas que trabajan sin señal (encolan y mandan solo al volver) y muestran su propio aviso:
 * la consola del chofer y la venta nueva. Ahí el aviso global de "modo lectura" sería falso.
 */
const RUTAS_CON_AVISO_PROPIO = ['/logistica/consola', '/ventas/nueva']

export function ocultaAvisoGlobalSinConexion(pathname: string | null | undefined): boolean {
  return !!pathname && RUTAS_CON_AVISO_PROPIO.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}

/**
 * Aviso global sin conexión (propuesta de Inicio, frame 10): decide una sola vez para toda la app si
 * se muestra, y cada barra superior (TopBar) lo pinta debajo de ella, sobre el fondo de la pantalla.
 * Va en el flujo, no flotando, y solo donde la pantalla es de lectura.
 *
 * No toca el margen del sistema: la barra ya lo pone y los modales de pantalla completa (otra ventana)
 * lo necesitan entero para que su barra no quede bajo la hora. El árbol es siempre el mismo (con o
 * sin aviso) para que perder la señal no vuelva a montar la navegación.
 */
export function OfflineBanner({ children }: { children?: React.ReactNode }) {
  const { isConnected } = useNetworkStatus()
  const pathname = usePathname()
  const visible = !isConnected && !ocultaAvisoGlobalSinConexion(pathname)

  return (
    <AvisoSinConexionContext.Provider value={visible}>
      <View style={{ flex: 1 }}>{children}</View>
    </AvisoSinConexionContext.Provider>
  )
}
