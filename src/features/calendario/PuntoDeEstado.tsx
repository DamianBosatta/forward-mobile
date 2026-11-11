import React from 'react'
import { Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import type { TonoDePunto } from './presentacion'

/** El estado con su punto de color y su texto, como la tarjeta de la web: el color nunca va solo. */
export function PuntoDeEstado({ tono, texto }: { tono: TonoDePunto; texto: string }) {
  const c = useColors()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] + 2 }}>
      <View style={{ width: 8, height: 8, borderRadius: radii.pastilla, backgroundColor: c[tono] }} />
      <Text style={{ ...typeScale.secundario, color: c.text }}>{texto}</Text>
    </View>
  )
}
