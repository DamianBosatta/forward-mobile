import { View } from 'react-native'
import { usePathname } from 'expo-router'
import { space } from '@/libs/theme'
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

/**
 * Aviso global sin conexión. Va en el flujo, debajo de las pantallas (no flotando encima del encabezado),
 * y solo donde la pantalla es de lectura.
 */
export function OfflineBanner() {
  const { isConnected } = useNetworkStatus()
  const pathname = usePathname()
  if (isConnected || ocultaAvisoGlobalSinConexion(pathname)) return null

  return (
    <View testID="aviso-sin-conexion" style={{ paddingHorizontal: space[3], paddingVertical: space[2] }}>
      <Notice tone="advertencia">Sin conexión - Modo lectura (Cache)</Notice>
    </View>
  )
}
