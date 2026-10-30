import React from 'react'
import { Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'

interface Props {
  /** Suma de todo el filtro que da el servidor (solo en la página 1); sin ella no hay resumen: no se suma en el teléfono. */
  saldoTotal?: number
}

/**
 * Tarjeta "Te deben" de Cuentas (lámina cuentas-lista). La transferencia entre cuentas propias vive en la barra superior.
 * TODO API: total vencido agregado de la cartera (chip "Vencido $ X") y cantidad de clientes con deuda; hoy el servidor
 * no los informa y no se suman en el teléfono.
 */
export function ResumenDeCuentas({ saldoTotal }: Props) {
  const c = useColors()
  if (saldoTotal === undefined) return null
  return (
    <View
      accessible
      accessibilityLabel={`Te deben: ${formatImporte(saldoTotal)}`}
      style={{ marginHorizontal: space[4], marginTop: space[3], backgroundColor: c.surface, borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, padding: space[4], gap: space[1] }}
    >
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Te deben</Text>
      <Text style={[typeScale.titulo, importe, { color: c.text }]}>{formatImporte(saldoTotal)}</Text>
    </View>
  )
}
