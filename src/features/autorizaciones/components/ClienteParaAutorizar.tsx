import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
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
export function ClienteParaAutorizar({ socio, enlace }: {
  socio: SocioDetailDto | null | undefined
  /** "Ver cuenta corriente del cliente" como fila con flecha dentro de la misma tarjeta (propuesta "Finanzas como venta", frame 19). */
  enlace?: { label: string; onPress: () => void }
}) {
  const c = useColors()
  const fila = enlace ? <EnlaceConFlecha {...enlace} /> : null
  const tarjeta = { padding: space[4], gap: space[2], borderRadius: radii.tarjeta, backgroundColor: c.surface }
  // Sin la ficha no hay datos del cliente, pero el enlace a su cuenta sigue (como hoy).
  if (!socio) return fila ? <View testID="enlace-cuenta" style={{ ...tarjeta, paddingVertical: space[1] }}>{fila}</View> : null
  const veImportes = socio.puedeVerSaldo === true
  return (
    <View testID="bloque-cliente" style={tarjeta}>
      <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.text }]}>Cliente</Text>
      <Fila etiqueta="Condición de pago" valor={textoCondicionPago(socio.condicionPago as CondicionPago | null | undefined)} />
      {veImportes && typeof socio.saldoAmount === 'number' ? <Fila etiqueta="Saldo" valor={formatImporte(socio.saldoAmount)} /> : null}
      {veImportes ? <CreditoDelCliente estado={creditoDelSocio(socio)} sinAviso /> : null}
      {fila ? (
        <>
          <View style={{ height: 1, backgroundColor: c.surface2 }} />
          {fila}
        </>
      ) : null}
    </View>
  )
}

function EnlaceConFlecha({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: c.surface2 }}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}
    >
      <Text style={[typeScale.cuerpoDestacado, { color: c.brandInk, flex: 1 }]}>{label}</Text>
      <View testID="fila-chevron">
        <ChevronRight size={20} color={c.brandInk} />
      </View>
    </Pressable>
  )
}
