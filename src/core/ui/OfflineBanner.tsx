import React, { useContext } from 'react'
import { View } from 'react-native'
import { usePathname } from 'expo-router'
import { SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context'
import { space, useColors } from '@/libs/theme'
import { useNetworkStatus } from '@/core/utils/useNetworkStatus'
import { Notice } from './fw'

/**
 * Pantallas que trabajan sin señal (encolan y mandan solo al volver) y muestran su propio aviso:
 * la consola del chofer y la venta nueva. Ahí el aviso global de "modo lectura" sería falso.
 */
const RUTAS_CON_AVISO_PROPIO = ['/logistica/consola', '/ventas/nueva']

export function ocultaAvisoGlobalSinConexion(pathname: string | null | undefined): boolean {
  return !!pathname && RUTAS_CON_AVISO_PROPIO.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}

const SIN_MARGENES: EdgeInsets = { top: 0, bottom: 0, left: 0, right: 0 }

/**
 * Aviso global sin conexión, arriba de todo (propuesta de Inicio, frame 10): se ve sin bajar y no lo
 * tapa la barra de abajo. Va en el flujo, no flotando, y solo donde la pantalla es de lectura.
 *
 * Envuelve a las pantallas y las corre hacia abajo; no cambia el margen del sistema que leen: los
 * modales de pantalla completa (otra ventana, encima del aviso) lo necesitan entero para que su barra
 * no quede bajo la hora. El árbol es siempre el mismo (con o sin aviso) para que perder la señal no
 * vuelva a montar la navegación.
 */
export function OfflineBanner({ children }: { children?: React.ReactNode }) {
  const { isConnected } = useNetworkStatus()
  const pathname = usePathname()
  const c = useColors()
  const insets = useContext(SafeAreaInsetsContext) ?? SIN_MARGENES
  const visible = !isConnected && !ocultaAvisoGlobalSinConexion(pathname)

  return (
    <View style={{ flex: 1 }}>
      {visible ? (
        // Sobre el fondo de la barra superior: el aviso queda dentro del encabezado oscuro, arriba del título.
        <View testID="aviso-sin-conexion" style={{ paddingTop: insets.top + space[2], paddingHorizontal: space[4], paddingBottom: space[2], backgroundColor: c.topBar }}>
          <Notice tone="advertencia">Sin conexión - Modo lectura (Cache)</Notice>
        </View>
      ) : null}
      {children}
    </View>
  )
}
