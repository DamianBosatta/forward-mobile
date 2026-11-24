import React from 'react'
import { Text } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, TotalsRow, formatImporte } from '@/core/ui/fw'
import type { TotalConIva } from '../lib/totalConIva'

export const MOTIVO_CALCULANDO_IVA = 'Esperá a que se calcule el total con IVA.'
/** Sin señal: la venta con factura se puede guardar en el teléfono, pero el total que se ve todavía no lleva IVA. */
export const SIN_SENAL = 'El total no incluye el IVA: se calcula cuando se envía la venta.'
export const ERROR_IVA = 'No pudimos calcular el IVA de la venta. Revisá la conexión y reintentá.'

/** Neto e IVA por alícuota de una venta con factura, tal cual los calculó el servidor; avisos si todavía no hay cálculo. */
export function FilasDeIva({ total, onReintentar }: { total: TotalConIva | undefined; onReintentar?: () => void }) {
  const c = useColors()
  if (!total || total.estado === 'sin') return null
  if (total.estado === 'calculando') return <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Calculando el IVA…</Text>
  if (total.estado === 'error') {
    return total.sinSenal
      ? <Notice tone="advertencia">{SIN_SENAL}</Notice>
      : (
        <>
          <Notice tone="peligro">{ERROR_IVA}</Notice>
          {onReintentar ? <Button label="Reintentar" variant="secundario" onPress={onReintentar} /> : null}
        </>
      )
  }
  const d = total.desglose
  if (!d) return null
  return (
    <>
      <TotalsRow label="Neto" importe={d.neto} />
      {d.porAlicuota.map((f) => <TotalsRow key={f.porcentaje} label={`IVA ${f.porcentaje} %`} importe={f.iva} />)}
    </>
  )
}

/** El pie de la entrega: el total del servidor con IVA cuando lo hay; si no, el estimado de siempre (o el estado del cálculo). */
export function totalDelPie(total: TotalConIva | undefined, estimado: number): { rotulo: string; texto: string } {
  if (total?.estado === 'listo' && total.desglose && total.total !== null) return { rotulo: 'Total', texto: formatImporte(total.total) }
  if (total?.estado === 'calculando') return { rotulo: 'Total', texto: 'Calculando…' }
  if (total?.estado === 'error' && !total.sinSenal) return { rotulo: 'Total', texto: '—' }
  if (total?.estado === 'error') return { rotulo: 'Total estimado sin IVA', texto: formatImporte(estimado) }
  return { rotulo: 'Total estimado', texto: formatImporte(estimado) }
}
