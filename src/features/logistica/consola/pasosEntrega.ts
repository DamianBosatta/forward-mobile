import { formatImporte } from '@/core/ui/fw/formatImporte'
import { leerNumero } from '@/src/utils/numero'
import { armarLinea, razonNoCobro, type Imputacion, type LineaCobroForm, type NoCobroForm } from './entrega'

/**
 * Los pasos de la entrega del chofer (lienzo de entrega): E1 reportar, E2 devolución, E3/E4 cobro y
 * firma, E6 confirmar. La foto (E5) se saca dentro del paso que la pide. Cada regla de "Continuar"
 * vive acá y devuelve el motivo por el que está apagado; `armarEntrega` sigue siendo quien arma el
 * cuerpo, con las mismas validaciones de siempre.
 */
export type Paso = 'reporte' | 'devolucion' | 'cobro' | 'resumen'

/** La devolución solo es un paso si el chofer dijo que hay. */
export const pasosDeEntrega = (hayDevolucion: boolean | null): Paso[] =>
  hayDevolucion ? ['reporte', 'devolucion', 'cobro', 'resumen'] : ['reporte', 'cobro', 'resumen']

export function razonReporte(ctx: {
  receptor: string
  hayDevolucion: boolean | null
  exigeFotoRemito: boolean
  remitoUrl: string | null
  subiendo: boolean
}): string | null {
  if (ctx.subiendo) return 'Subiendo la foto: esperá un momento'
  if (ctx.hayDevolucion === null) return 'Elegí si hay devolución'
  // Quién recibió es obligatorio siempre (decisión del dueño del 16-10), con o sin la foto del remito.
  if (!ctx.receptor.trim()) return 'Falta quién recibió'
  if (ctx.exigeFotoRemito && !ctx.remitoUrl) return 'Falta la foto del remito'
  return null
}

/** Al menos un producto, y nada que el servidor rechace seguro (mismos textos que `armarEntrega`). */
export function razonDevolucion(valores: Record<string, string>, disponibles: Record<string, number>): string | null {
  let alguno = false
  for (const [id, valor] of Object.entries(valores)) {
    if (!valor.trim()) continue
    const cantidad = leerNumero(valor)
    if (cantidad == null || cantidad < 0) return 'Revisá las cantidades devueltas.'
    if (cantidad > (disponibles[id] ?? 0)) return 'Se devuelve más de lo que se puede devolver de un producto.'
    if (cantidad > 0) alguno = true
  }
  return alguno ? null : 'Indicá qué devuelve'
}

const centavos = (n: number) => Math.round(n * 100)

/** Suma de las líneas con monto válido. */
export function totalRepartido(lineas: LineaCobroForm[]): number {
  return lineas.reduce((t, l) => {
    const m = leerNumero(l.monto)
    return m != null && m > 0 ? t + m : t
  }, 0)
}

export interface ContextoCobro {
  lineas: LineaCobroForm[]
  imputacion: Imputacion
  firmar: boolean
  firmaUrl: string | null
  /** Lo que hay que cobrar en la parada (lo decide el servidor), si lo manda. */
  aCobrar: number | null
  hayDevolucion: boolean
  subiendo: boolean
  /** "No cobré" (C2): pide el motivo en lugar de las líneas. */
  noCobro?: NoCobroForm | null
}

/**
 * Si el cobro se compara con "A cobrar hoy" y cómo. Sin importe del servidor o con el cobro a la deuda
 * anterior (cuyo saldo la app no recibe) no se compara. Solo avisa, nunca frena (decisión del dueño, 22-10):
 * lo que sobra va a la deuda más vieja y lo que falta lo valida el servidor. Con firma o devolución,
 * que falte es lo esperado (queda en la cuenta o lo descuenta el servidor): no se avisa.
 */
export function comparacionDeCobro(c: ContextoCobro): { total: number; resto: number; avisaSobra: boolean; avisaFalta: boolean } | null {
  if (c.aCobrar == null || c.lineas.length === 0 || c.imputacion === 'DeudaAnterior') return null
  const total = c.aCobrar
  const resto = (centavos(total) - centavos(totalRepartido(c.lineas))) / 100
  return { total, resto, avisaSobra: resto < 0, avisaFalta: resto > 0 && !c.firmar && !c.hayDevolucion }
}

/** "Faltan $ X" / "Sobran $ X" para mostrar en rojo; no impide continuar. */
export function avisoDeCobro(c: ContextoCobro): string | null {
  const cmp = comparacionDeCobro(c)
  if (cmp?.avisaSobra) return `Sobran ${formatImporte(-cmp.resto)}`
  if (cmp?.avisaFalta) return `Faltan ${formatImporte(cmp.resto)}`
  return null
}

export function razonCobro(c: ContextoCobro): string | null {
  if (c.subiendo) return 'Subiendo la foto: esperá un momento'
  if (c.noCobro) {
    const falta = razonNoCobro(c.noCobro)
    if (falta) return falta
  }
  for (const [i, l] of (c.noCobro ? [] : c.lineas).entries()) {
    const r = armarLinea(l, i + 1)
    if ('error' in r) return r.error
  }
  if (c.firmar && !c.firmaUrl) return 'Falta la foto de la firma'
  return null
}

/** "$ 600,00 de $ 1.000,00" y la tilde cuando cuadra. */
export function textoRepartido(c: ContextoCobro): string {
  const suma = totalRepartido(c.lineas)
  const cmp = comparacionDeCobro(c)
  if (!cmp) return formatImporte(suma)
  return `${formatImporte(suma)} de ${formatImporte(cmp.total)}${cmp.resto === 0 ? ' ✓' : ''}`
}
