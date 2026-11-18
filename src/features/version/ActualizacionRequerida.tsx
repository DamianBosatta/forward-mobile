import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { space, typeScale, useColors } from '@/libs/theme'
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
        <EstadoDePantalla
          tipo="error"
          titulo="Hay que actualizar la app"
          texto={TEXTO}
          accion={{ label: 'Volver a comprobar', onPress: onReintentar }}
        />
        {/* Same readable centered column on phone and tablet. */}
        <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: space[6] }}>
          <Text style={[typeScale.cuerpo, { color: c.textSecondary, textAlign: 'center' }]}>
            {`Tu versión: ${instalada} · Mínima: ${minima}`}
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
