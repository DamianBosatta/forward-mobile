import React from 'react'
import { Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

/** Aviso chico de un pago ("ANULADO", "Sin movimiento de caja"), en píldora `surfaceAlt` y en texto: el color no va solo. */
export function InsigniaDePago({ texto }: { texto: string }) {
  const c = useColors()
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: c.surfaceAlt, borderRadius: radii.pastilla, paddingHorizontal: space[3], paddingVertical: space[1] }}>
      <Text style={{ ...typeScale.etiquetaChip, color: c.text }}>{texto}</Text>
    </View>
  )
}
