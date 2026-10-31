import type { components } from '@/libs/api-client/generated/schema'
import { partesArgentina, parseDateSafe } from '@/src/utils/date'

type Pagos = components['schemas']['VentaPagosDto']

export interface CobroDeLaVenta {
  filas: { clave: string; texto: string; monto: number }[]
  saldo: number | null
}

const dos = (n: number) => String(n).padStart(2, '0')

/**
 * Tarjeta "Cobro" del detalle (mockup ventas-detalle): un renglón por cobro ("Cobrado 30/10 · Transferencia") y el saldo.
 * Sale de GET /Ventas/{id}/pagos; las notas de crédito no son cobros. Sin cobros devuelve null y la tarjeta no se dibuja.
 * La cuenta propia donde entró el cobro (`cuentaNombre`, "Banco Galicia") va al final; null en efectivo y sin líneas.
 */
export function cobroDeLaVenta(pagos: Pagos | undefined | null): CobroDeLaVenta | null {
  if (!pagos) return null
  const filas = (pagos.imputaciones ?? [])
    .filter((i) => i.origen !== 'NotaCredito' && i.monto > 0)
    .map((i, n) => {
      const instante = parseDateSafe(i.fechaImputacion)
      const f = instante ? partesArgentina(instante.getTime()) : null
      // partesArgentina.mes va de 0 a 11 (igual que Date), como lo usa diaDeEntregaCorto.
      const dia = f ? `${dos(f.dia)}/${dos(f.mes + 1)}` : null
      return { clave: `${i.numeroPago}-${n}`, texto: ['Cobrado' + (dia ? ` ${dia}` : ''), i.medioPago, i.cuentaNombre].filter(Boolean).join(' · '), monto: i.monto }
    })
  if (filas.length === 0) return null
  return { filas, saldo: pagos.saldoPendiente ?? null }
}
