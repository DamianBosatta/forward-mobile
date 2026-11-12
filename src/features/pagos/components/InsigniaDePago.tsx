import React from 'react'
import { Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

/** Aviso chico de un pago ("ANULADO", "Sin movimiento de caja"), con borde y en texto: el color no va solo. */
export function InsigniaDePago({ texto }: { texto: string }) {
  const c = useColors()
  return (
    <View style={{ alignSelf: 'flex-start', borderWidth: 1, borderColor: c.border, borderRadius: radii.pastilla, paddingHorizontal: space[2], paddingVertical: 2 }}>
      <Text style={{ ...typeScale.etiqueta, fontWeight: '600', color: c.textSecondary }}>{texto}</Text>
    </View>
  )
}
