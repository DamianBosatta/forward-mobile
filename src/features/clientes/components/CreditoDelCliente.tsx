import React from 'react'
import { Text, View } from 'react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { Notice, formatImporte } from '@/core/ui/fw'
import type { EstadoCuentaDto } from '@/libs/api-client/types'

export const AVISO_DEUDA_VENCIDA = 'Tiene deuda vencida de más de 30 días: los pedidos nuevos van a quedar por autorizar.'

/** Los datos de crédito que usa la tarjeta: los trae el estado de cuenta y, armados a mano, la ficha del socio. */
export type DatosDeCredito = Pick<
  EstadoCuentaDto,
  'tieneDeudaVencida' | 'deudaVencida' | 'deudaVencidaTst' | 'deudaVencidaNormal' | 'creditoDisponible'
>

export function Fila({ etiqueta, valor, alerta = false }: { etiqueta: string; valor: string; alerta?: boolean }) {
  const c = useColors()
  const color = alerta ? c.chip.anulado.text : c.textSecondary
  return (
    <View
      accessible
      accessibilityLabel={`${etiqueta}: ${valor}`}
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] }}
    >
      <Text style={{ ...typeScale.secundario, color: c.textSecondary, flexShrink: 1 }}>{etiqueta}</Text>
      <Text style={[typeScale.secundario, importe, { color, textAlign: 'right', flexShrink: 1 }]}>{valor}</Text>
    </View>
  )
}

/** El disponible como se lee en la app: el importe, o cuánto se pasó del tope si es negativo. */
export const textoDisponible = (disponible: number) =>
  disponible < 0 ? `Pasado del tope por ${formatImporte(-disponible)}` : formatImporte(disponible)

/** En qué cuenta está lo vencido: "TST", "Normal" o el importe de cada una si están las dos. */
function vencidoPorCuenta(e: DatosDeCredito): string {
  const tst = e.deudaVencidaTst ?? 0
  const normal = e.deudaVencidaNormal ?? 0
  if (tst > 0 && normal > 0) return ` · TST ${formatImporte(tst)} · Normal ${formatImporte(normal)}`
  if (tst > 0) return ' · TST'
  if (normal > 0) return ' · Normal'
  return ''
}

/**
 * Vencido y disponible del estado de cuenta (forward-system PR #882), con la regla del servidor:
 * mobile no calcula vencimientos ni topes. Lo que el servidor no manda (o manda null) no se muestra,
 * así que con un servidor anterior la tarjeta queda como antes.
 * `sinAviso`: sin el cartel de "los pedidos nuevos van a quedar por autorizar", para quien ya está
 * autorizando uno.
 */
export function CreditoDelCliente({ estado, sinAviso = false }: { estado: DatosDeCredito; sinAviso?: boolean }) {
  const vencida = estado.tieneDeudaVencida === true && typeof estado.deudaVencida === 'number'
  const disponible = typeof estado.creditoDisponible === 'number' ? estado.creditoDisponible : null
  return (
    <>
      {vencida ? (
        <Fila etiqueta="Vencido (más de 30 días)" valor={`${formatImporte(estado.deudaVencida)}${vencidoPorCuenta(estado)}`} alerta />
      ) : null}
      {disponible !== null ? (
        <Fila
          etiqueta="Disponible"
          valor={textoDisponible(disponible)}
          alerta={disponible < 0}
        />
      ) : null}
      {vencida && !sinAviso ? <Notice tone="advertencia">{AVISO_DEUDA_VENCIDA}</Notice> : null}
    </>
  )
}
