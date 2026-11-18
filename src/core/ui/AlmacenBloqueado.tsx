import React, { useEffect, useState } from 'react'
import { DevSettings, View } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import { useColors } from '@/libs/theme'
import { logger } from '@/core/utils/logger'
import { sePuedeAbrirElAlmacen, type MotivoDeBloqueo } from '@/core/utils/storage'
import { EstadoDePantalla } from './fw/EstadoDePantalla'

const TEXTO =
  'Lo que guardaste en el teléfono, como los envíos pendientes, sigue guardado y no se borró. Tocá Reintentar; si sigue igual, reiniciá el teléfono.'
const TEXTO_TODAVIA_NO =
  'Todavía no se pudo. Lo que guardaste sigue guardado y no se borró. Esperá unos segundos y tocá Reintentar; si sigue igual, reiniciá el teléfono.'

interface AlmacenBloqueadoVistaProps {
  reintentoFallido: boolean
  onReintentar: () => void
}

/** SEG-01: the phone's encrypted storage did not open. Says the data is safe and offers Reintentar. */
export function AlmacenBloqueadoVista({ reintentoFallido, onReintentar }: AlmacenBloqueadoVistaProps) {
  const c = useColors()
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <EstadoDePantalla
        tipo="sinPermiso"
        titulo="No pudimos abrir lo guardado en el teléfono"
        texto={reintentoFallido ? TEXTO_TODAVIA_NO : TEXTO}
        accion={{ label: 'Reintentar', onPress: onReintentar }}
      />
    </View>
  )
}

/** Reloads the JS bundle so every store reads the real file from the start. */
function recargarLaApp() {
  try {
    // Optional native module, as in perfil/lib/version.ts: absent in a dev client without expo-updates.
    const Updates = require('expo-updates') as typeof import('expo-updates')
    Updates.reloadAsync().catch(() => DevSettings.reload())
  } catch {
    DevSettings.reload()
  }
}

/**
 * Shown instead of the whole app while the encrypted storage is blocked. Reports it once to Sentry (only the reason,
 * never the key) and, on Reintentar, reloads the app only if the key reads now.
 */
export function AlmacenBloqueado({ motivo }: { motivo: MotivoDeBloqueo }) {
  const [reintentoFallido, setReintentoFallido] = useState(false)

  useEffect(() => {
    // The app never renders its own screens here, so the splash would stay up.
    SplashScreen.hideAsync().catch(() => {})
    // Storage opens at import, before Sentry.init: the report goes out once the app mounts.
    logger.error(new Error(`Encrypted storage blocked: ${motivo}`))
  }, [motivo])

  const reintentar = () => {
    if (sePuedeAbrirElAlmacen()) {
      recargarLaApp()
      return
    }
    setReintentoFallido(true)
  }

  return <AlmacenBloqueadoVista reintentoFallido={reintentoFallido} onReintentar={reintentar} />
}
