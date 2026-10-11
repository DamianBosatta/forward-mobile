import React from 'react'
import { Text, View } from 'react-native'
import { importe as cifras, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from './formatImporte'

interface TotalsRowProps {
  label: string
  importe: number | null | undefined
  /** El total: etiqueta 16/600, importe 20/600 y un borde arriba. */
  destacado?: boolean
}

/** Fila de totales de la lámina F4 (subtotal, flete, total). */
export function TotalsRow({ label, importe, destacado = false }: TotalsRowProps) {
  const c = useColors()
  const etiqueta = destacado ? [typeScale.cuerpoDestacado, { color: c.text }] : [typeScale.secundario, { color: c.textSecondary }]
  const valor = destacado ? [typeScale.titulo, { color: c.text }] : [typeScale.secundario, { color: c.textSecondary }]
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${formatImporte(importe)}`}
      style={[
        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] },
        destacado && { borderTopWidth: 1, borderTopColor: c.border, paddingTop: space[2], marginTop: space[1] },
      ]}
    >
      <Text style={[etiqueta, { flexShrink: 1 }]}>{label}</Text>
      <Text style={[valor, cifras, { textAlign: 'right' }]}>{formatImporte(importe)}</Text>
    </View>
  )
}
