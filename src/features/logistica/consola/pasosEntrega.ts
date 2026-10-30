import { formatImporte } from '@/core/ui/fw/formatImporte'
import { leerNumero } from '@/src/utils/numero'
import { armarLinea, razonNoCobro, type Imputacion, type LineaCobroForm, type NoCobroForm } from './entrega'

/**
 * Los pasos de la entrega del chofer (lienzo de entrega, láminas chofer-03 a chofer-05): devolución,
 * cobro y confirmar. "Llegué" es el paso 1 y vive afuera. La foto del remito, el receptor y la firma se
 * piden al confirmar. Cada regla de "Continuar" vive acá y devuelve el motivo por el que está apagado;
 * `armarEntrega` sigue siendo quien arma el cuerpo, con las mismas validaciones de siempre.
 */
export type Paso = 'devolucion' | 'cobro' | 'confirmar'

export const PASOS: readonly Paso[] = ['devolucion', 'cobro', 'confirmar']

/**
 * "Paso 2 de 4": llegué (1) + devolución (2) + cobro (3) + confirmar (4). Con "No, todo bien" el chofer igual pasó
 * por la pregunta de devolución, así que el total y el número de cada paso no cambian a mitad de la parada.
 */
export function posicionDePaso(paso: Paso): { numero: number; total: number } {
  return { numero: PASOS.indexOf(paso) + 2, total: PASOS.length + 1 }
}

/** Paso de devolución: hay que haber elegido, y si devuelve, cargar algo válido. */
export function razonDevolucionPaso(hayDevolucion: boolean | null, valores: Record<string, string>, disponibles: Record<string, number>): string | null {
  if (hayDevolucion === null) return 'Elegí si hay devolución'
  return hayDevolucion ? razonDevolucion(valores, disponibles) : null
}

export function razonConfirmar(ctx: { receptor: string; exigeFotoRemito: boolean; remitoUrl: string | null; subiendo: boolean }): string | null {
  if (ctx.subiendo) return 'Subiendo la foto: esperá un momento'
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
 * lo que sobra va a la deuda más vieja y lo que falta lo valida el servidor. Con devolución, que falte es
 * lo esperado (lo descuenta el servidor): no se avisa. Lo que falta queda en la cuenta corriente.
 */
export function comparacionDeCobro(c: ContextoCobro): { total: number; resto: number; avisaSobra: boolean; avisaFalta: boolean } | null {
  if (c.aCobrar == null || c.lineas.length === 0 || c.imputacion === 'DeudaAnterior') return null
  const total = c.aCobrar
  const resto = (centavos(total) - centavos(totalRepartido(c.lineas))) / 100
  return { total, resto, avisaSobra: resto < 0, avisaFalta: resto > 0 && !c.hayDevolucion }
}

/** "Sobran $ X" para mostrar en rojo; no impide continuar. Lo que falta no es un error: queda en la cuenta (`faltaACuenta`). */
export function avisoDeCobro(c: ContextoCobro): string | null {
  const cmp = comparacionDeCobro(c)
  return cmp?.avisaSobra ? `Sobran ${formatImporte(-cmp.resto)}` : null
}

/** Lo que falta cobrar y queda como deuda en la cuenta corriente (chofer-04--mixto); `null` si no falta o no se compara. */
export function faltaACuenta(c: ContextoCobro): number | null {
  const cmp = comparacionDeCobro(c)
  return cmp?.avisaFalta ? cmp.resto : null
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
  return null
}
