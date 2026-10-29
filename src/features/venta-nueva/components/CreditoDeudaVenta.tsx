import React from 'react'
import { Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice, formatImporte } from '@/core/ui/fw'
import { useSocio } from '@/libs/api-client/socios'
import type { TipoDocumento } from '@/features/clientes/components/SeleccionarClienteSheet'
import { AVISO_DEUDA_VENCIDA, textoDisponible } from '@/features/clientes/components/CreditoDelCliente'

interface Props {
  clienteId: string
  tipo: TipoDocumento
}

/**
 * El crédito disponible y la deuda vencida del cliente de la venta (lo que el servidor deja ver) y, en un pedido,
 * el aviso de deuda vencida. Salía de la pantalla "¿Cómo arrancás?"; ahora se ve en el catálogo apenas se elige el cliente.
 */
export function CreditoDeudaVenta({ clienteId, tipo }: Props) {
  const c = useColors()
  const s = useSocio(clienteId).data
  // Crédito y deuda: solo si el servidor los manda y deja ver importes (`puedeVerSaldo`); si no, no se muestran.
  const disponible = s?.puedeVerSaldo === true && typeof s.creditoDisponible === 'number' ? s.creditoDisponible : null
  const vencida = s?.tieneDeudaVencida === true
  const montoVencido = vencida && typeof s?.deudaVencidaAmount === 'number' ? s.deudaVencidaAmount : null
  const deuda = vencida ? (montoVencido !== null ? formatImporte(montoVencido) : 'Sí') : 'Ninguna'
  const tarjeta = { flex: 1, padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }
  if (disponible === null && s?.tieneDeudaVencida === undefined) return null
  return (
    <View style={{ paddingHorizontal: space[4], paddingTop: space[3], gap: space[2] }}>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        {disponible !== null ? (
          <View accessible accessibilityLabel={`Crédito disponible: ${textoDisponible(disponible)}`} style={tarjeta}>
            <Text style={{ ...typeScale.etiqueta, color: c.textSecondary }}>Crédito disponible</Text>
            <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: disponible < 0 ? c.chip.anulado.text : c.text }}>{textoDisponible(disponible)}</Text>
          </View>
        ) : null}
        {s?.tieneDeudaVencida !== undefined ? (
          <View accessible accessibilityLabel={`Deuda vencida: ${deuda}`} style={tarjeta}>
            <Text style={{ ...typeScale.etiqueta, color: c.textSecondary }}>Deuda vencida</Text>
            <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: vencida ? c.chip.anulado.text : c.chip.entregado.text }}>{deuda}</Text>
          </View>
        ) : null}
      </View>
      {vencida && tipo === 'Pedido' ? <Notice tone="advertencia">{AVISO_DEUDA_VENCIDA}</Notice> : null}
    </View>
  )
}
