import React from 'react'
import { Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { pesoSemibold } from '@/core/ui/fw'
import { useHojaRuta, type VentaPreparacion } from '@/libs/api-client/logistica'
import { useVenta } from '@/libs/api-client'

/**
 * Datos de una entrega fallida tal como los devuelve el servidor: el motivo y el chofer salen de la
 * parada en la hoja de ruta del pedido; las observaciones, de la venta.
 */
export function DatosDeEntregaFallida({ pedido }: { pedido: VentaPreparacion }) {
  const c = useColors()
  const hoja = useHojaRuta(pedido.hojaRutaId ?? '')
  const venta = useVenta(pedido.id)
  const parada = hoja.data?.detalles?.find((p) => p.ventaId === pedido.id)
  const motivo = parada?.motivoRechazo?.trim()
  const observaciones = venta.data?.venta?.observaciones?.trim()
  const chofer = hoja.data?.choferNombre
  if (!motivo && !observaciones && !chofer) return null
  return (
    <View style={{ gap: space[1] }}>
      {motivo ? <Text style={{ ...typeScale.secundario, ...pesoSemibold, color: c.text }}>{`Motivo: ${motivo}`}</Text> : null}
      {observaciones ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Observaciones: ${observaciones}`}</Text> : null}
      {chofer ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`${chofer} (chofer)`}</Text> : null}
    </View>
  )
}
