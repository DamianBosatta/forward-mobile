import React from 'react'
import { Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import type { SocioDetailDto } from '@/libs/api-client/types'
import { textoCondicionPago, type CondicionPago } from '@/features/clientes/lib/cliente'
import { CreditoDelCliente, Fila, type DatosDeCredito } from '@/features/clientes/components/CreditoDelCliente'

/**
 * Lo vencido y el disponible del cliente en el formato que entiende `CreditoDelCliente`. La ficha
 * del socio los llama `deudaVencidaAmount`, etc.; lo que un servidor anterior no manda queda undefined.
 */
function creditoDelSocio(s: SocioDetailDto): DatosDeCredito {
  return {
    tieneDeudaVencida: typeof s.deudaVencidaAmount === 'number' ? s.deudaVencidaAmount > 0 : undefined,
    deudaVencida: s.deudaVencidaAmount,
    deudaVencidaTst: s.deudaVencidaTstAmount,
    deudaVencidaNormal: s.deudaVencidaNormalAmount,
    creditoDisponible: s.creditoDisponible,
  }
}

/**
 * Cliente de la venta que se está por autorizar (lámina AutorizarVenta): condición de pago, saldo,
 * vencido y disponible, de la ficha del cliente (forward-system #882, sin cambios en el servidor).
 *
 * Sin la ficha (cargando, 403, 404, error) no se muestra nada. Los importes salen solo si el servidor
 * dice `puedeVerSaldo`: sin eso el saldo llega redactado en 0 y mostrarlo sería mentir. Lo que un
 * servidor anterior no manda no se muestra; el teléfono no calcula vencimientos ni topes.
 */
export function ClienteParaAutorizar({ socio }: { socio: SocioDetailDto | null | undefined }) {
  const c = useColors()
  if (!socio) return null
  const veImportes = socio.puedeVerSaldo === true
  return (
    <View
      testID="bloque-cliente"
      style={{ padding: space[4], gap: space[2], borderRadius: radii.tarjeta, backgroundColor: c.surface }}
    >
      <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.text }]}>Cliente</Text>
      <Fila etiqueta="Condición de pago" valor={textoCondicionPago(socio.condicionPago as CondicionPago | null | undefined)} />
      {veImportes && typeof socio.saldoAmount === 'number' ? <Fila etiqueta="Saldo" valor={formatImporte(socio.saldoAmount)} /> : null}
      {veImportes ? <CreditoDelCliente estado={creditoDelSocio(socio)} sinAviso /> : null}
    </View>
  )
}
