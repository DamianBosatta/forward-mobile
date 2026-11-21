import React from 'react'
import { Text, View } from 'react-native'
import { importe as cifras, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from './formatImporte'

interface TotalsRowProps {
  label: string
  importe: number | null | undefined
  /** El total: etiqueta 16/800, importe 20/800 y una línea arriba. */
  destacado?: boolean
  /**
   * `sobreLima`: dentro de la tarjeta lime, todo en `ink` y el total con una línea de 2 px (Cobro del detalle de venta).
   * `acento`: el total sin línea y con el importe en `accentText` (Neto del mes de reportes). Sin tono, lo de siempre.
   */
  tono?: 'normal' | 'sobreLima' | 'acento'
}

/** Fila de totales de la lámina F4 (subtotal, flete, total). */
export function TotalsRow({ label, importe, destacado = false, tono = 'normal' }: TotalsRowProps) {
  const c = useColors()
  const sobreLima = tono === 'sobreLima'
  const acento = tono === 'acento'
  const etiqueta = destacado ? [typeScale.cuerpoDestacado, { color: sobreLima ? c.ink : c.text }]
    : sobreLima ? [typeScale.cuerpo, { color: c.ink }] : [typeScale.secundario, { color: c.textSecondary }]
  const valor = destacado ? [typeScale.titulo, { color: sobreLima ? c.ink : acento ? c.accentText : c.text }]
    : sobreLima ? [typeScale.cuerpoDestacado, { color: c.ink }] : [typeScale.secundario, { color: c.textSecondary }]
  const linea = destacado && !acento ? (sobreLima ? { borderTopWidth: 2, borderTopColor: c.ink, paddingTop: space[3] } : { borderTopWidth: 1, borderTopColor: c.border, paddingTop: space[2], marginTop: space[1] }) : null
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${formatImporte(importe)}`}
      style={[
        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] },
        linea,
      ]}
    >
      <Text style={[etiqueta, { flexShrink: 1 }]}>{label}</Text>
      <Text style={[valor, cifras, { textAlign: 'right' }]}>{formatImporte(importe)}</Text>
    </View>
  )
}
