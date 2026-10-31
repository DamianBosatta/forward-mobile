import React from 'react'
import { Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'

interface Props {
  /** Suma de todo el filtro que da el servidor (solo en la página 1); sin ella no hay resumen: no se suma en el teléfono. */
  saldoTotal?: number
  /** Clientes con deuda (`GET /deudas/resumen`, MOD_PAGOS:Read); sin el dato (sin permiso o cargando) no se muestra la línea. */
  clientesConDeuda?: number
}

/**
 * Tarjeta "Te deben" de Cuentas (lámina cuentas-lista). La transferencia entre cuentas propias vive en la barra superior.
 * TODO API: total vencido agregado de la cartera (chip "Vencido $ X"); hoy el servidor no lo informa y no se suma en el teléfono.
 */
export function ResumenDeCuentas({ saldoTotal, clientesConDeuda }: Props) {
  const c = useColors()
  if (saldoTotal === undefined) return null
  const clientes = clientesConDeuda === undefined ? null : `${clientesConDeuda} ${clientesConDeuda === 1 ? 'cliente con deuda' : 'clientes con deuda'}`
  return (
    <View
      accessible
      accessibilityLabel={`Te deben: ${formatImporte(saldoTotal)}${clientes ? `, ${clientes}` : ''}`}
      style={{ marginHorizontal: space[4], marginTop: space[3], backgroundColor: c.surface, borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, padding: space[4], gap: space[1] }}
    >
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Te deben</Text>
      <Text style={[typeScale.titulo, importe, { color: c.text }]}>{formatImporte(saldoTotal)}</Text>
      {clientes ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{clientes}</Text> : null}
    </View>
  )
}
