import React from 'react'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { space, useColors } from '@/libs/theme'
import { EstadoDePantalla } from '@/core/ui/fw/EstadoDePantalla'

const TEXTO =
  'Esta versión de Forward Mobile ya no se puede usar. Actualizá la app y volvé a abrirla. Si no sabés cómo, pedile la versión nueva al administrador.'

interface Props {
  instalada: string
  minima: string
  onReintentar: () => void
}

/** OPS-03: shown instead of the whole app (login included) when the installed version is older than the minimum. */
export function ActualizacionRequerida({ instalada, minima, onReintentar }: Props) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Scrolls: a large system font must not push the button off the screen. */}
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top, paddingBottom: insets.bottom + space[6] }}>
        {/* The version pair goes inside the centered column, right under the explanation: as a separate
            sibling it was pushed to the bottom edge by EstadoDePantalla's flex: 1. */}
        {/* Readable column on tablets: without a cap the explanation became one ~1600 px line in landscape. */}
        <View style={{ flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <EstadoDePantalla
            tipo="error"
            titulo="Hay que actualizar la app"
            texto={`${TEXTO}\n\nTu versión: ${instalada} · Mínima: ${minima}`}
            accion={{ label: 'Volver a comprobar', onPress: onReintentar }}
          />
        </View>
      </ScrollView>
    </View>
  )
}
