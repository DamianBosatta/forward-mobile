import type { CuerpoEntregaParada, MedioCobroChofer } from '@/libs/api-client/logistica'
import type { components } from '@/libs/api-client/generated/schema'
import { leerNumero } from '@/src/utils/numero'
import { leerFecha } from '@/features/cuentas/lib/cobro'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'

export type Imputacion = 'PedidoActual' | 'DeudaAnterior'

export interface ChequeForm {
  numero: string
  banco: string
  titular: string
  /** dd/mm/aaaa */
  emision: string
  /** dd/mm/aaaa */
  pago: string
}

export interface LineaCobroForm {
  medio: MedioCobroChofer | null
  monto: string
  fotoUrl: string | null
  cheque: ChequeForm
}

/** Lámina ChoferEntrega (C2): por qué no cobró. Lista fija del dueño (23-10); "Otro" pide un texto corto. */
export const MOTIVOS_NO_COBRO = ['No estaba', 'No tenía plata', 'Paga en el local', 'Otro'] as const
export type MotivoNoCobro = (typeof MOTIVOS_NO_COBRO)[number]
/** Largo del texto de "Otro": cabe en las observaciones de la entrega (el servidor acepta hasta 1000). */
export const MAX_OTRO_NO_COBRO = 80

export interface NoCobroForm {
  motivo: MotivoNoCobro | null
  otro: string
}

/** Por qué no se puede seguir con "No cobré"; `null` si está completo. */
export function razonNoCobro(n: NoCobroForm): string | null {
  if (!n.motivo) return 'Elegí por qué no cobraste'
  if (n.motivo === 'Otro' && !n.otro.trim()) return 'Escribí por qué no cobraste'
  return null
}

/**
 * Las observaciones de la entrega: "No cobré: <motivo>" adelante de lo que escribió el chofer. El motivo
 * no tiene columna propia (decisión del dueño, 23-10): viaja en el campo de observaciones de siempre.
 */
export function observacionesDeEntrega(observaciones: string, noCobro: NoCobroForm | null | undefined, motivoDevolucion?: string | null): string | undefined {
  const motivo = noCobro?.motivo ? (noCobro.motivo === 'Otro' ? noCobro.otro.trim() : noCobro.motivo) : null
  return [motivo ? `No cobré: ${motivo}` : null, motivoDevolucion ? `Devolución: ${motivoDevolucion}` : null, observaciones.trim()].filter(Boolean).join(' · ') || undefined
}

/** Chofer-03--productos: por qué vuelve la mercadería. TODO API: sin campo propio por devolución, viaja en las observaciones. */
export const MOTIVOS_DEVOLUCION = ['Vencido', 'Roto o dañado', 'No lo pidió', 'Otro'] as const

export interface FormEntrega {
  receptor: string
  observaciones: string
  /** Foto del remito firmado, ya subida. */
  remitoUrl: string | null
  lineas: LineaCobroForm[]
  imputacion: Imputacion
  /** Foto de la firma del cliente por lo que no paga, ya subida. */
  firmaUrl: string | null
  /** Cantidad devuelta por renglón (`ventaDetalleId` → texto del campo). */
  devolucion: Record<string, string>
  /** "No cobré" (C2): con valor, las líneas de cobro no viajan y el motivo va en las observaciones. */
  noCobro?: NoCobroForm | null
  /** Solo viaja si hay devolución (observaciones, TODO API). */
  motivoDevolucion?: string | null
}

/** El cuerpo sin la clave: la clave la pone la consola, una por parada, para que los reintentos la repitan. */
export type EntregaArmada = Omit<CuerpoEntregaParada, 'claveIdempotencia'>

type LineaCobro = components['schemas']['LineaCobroEntregaInput']
type RenglonDevuelto = components['schemas']['NotaCreditoItemInput']

export function armarLinea(l: LineaCobroForm, n: number): { linea: LineaCobro } | { error: string } {
  if (!l.medio) return { error: `Elegí el medio del cobro ${n}.` }
  const monto = leerNumero(l.monto)
  if (monto == null || monto <= 0) return { error: `El monto del cobro ${n} tiene que ser mayor a cero.` }
  const base = { medioPagoId: l.medio.id, monto, fotoUrl: l.fotoUrl ?? undefined }
  if (l.medio.tipo === 'Transferencia' && !l.fotoUrl) return { error: `Falta la foto del comprobante de la transferencia (cobro ${n}).` }
  if (l.medio.tipo !== 'Cheque') return { linea: base }
  const { numero, banco, titular } = l.cheque
  if (!numero.trim() || !banco.trim() || !titular.trim()) return { error: `Completá número, banco y titular del cheque (cobro ${n}).` }
  const fechaEmision = leerFecha(l.cheque.emision)
  const fechaPago = leerFecha(l.cheque.pago)
  if (!fechaEmision || !fechaPago) return { error: `Las fechas del cheque van como dd/mm/aaaa (cobro ${n}).` }
  // Un cheque por línea: su monto es el de la línea (el servidor exige que cuadren).
  const cheque = { numero: numero.trim(), banco: banco.trim(), titular: titular.trim(), fechaEmision, fechaPago, monto, imagenUrl: l.fotoUrl ?? undefined }
  return { linea: { ...base, cheques: [cheque] } }
}

/**
 * Arma el cuerpo de la entrega con lo que hizo el chofer. Solo frena lo que el servidor rechazaría
 * seguro; precios, deuda e imputación los decide él.
 */
export function armarEntrega(
  f: FormEntrega,
  ctx: { exigeFotoRemito: boolean; disponibles: Record<string, number> },
): { entrega: EntregaArmada } | { error: string } {
  const receptor = f.receptor.trim()
  if (!receptor) return { error: 'Falta quién recibió.' }
  if (ctx.exigeFotoRemito && !f.remitoUrl) return { error: 'Falta la foto del remito firmado: sin ella no se confirma la entrega.' }

  const noCobro = f.noCobro ?? null
  const faltaMotivo = noCobro ? razonNoCobro(noCobro) : null
  if (faltaMotivo) return { error: faltaMotivo }

  const lineas: LineaCobro[] = []
  for (const [i, l] of (noCobro ? [] : f.lineas).entries()) {
    const r = armarLinea(l, i + 1)
    if ('error' in r) return r
    lineas.push(r.linea)
  }

  const items: RenglonDevuelto[] = []
  for (const [ventaDetalleId, valor] of Object.entries(f.devolucion)) {
    if (!valor.trim()) continue
    const cantidad = leerNumero(valor)
    if (cantidad == null || cantidad < 0) return { error: 'Revisá las cantidades devueltas.' }
    if (cantidad === 0) continue
    if (cantidad > (ctx.disponibles[ventaDetalleId] ?? 0)) return { error: 'Se devuelve más de lo que se puede devolver de un producto.' }
    items.push({ ventaDetalleId, cantidad })
  }

  return {
    entrega: {
      nombreReceptor: receptor,
      evidenciaUrl: f.remitoUrl ?? undefined,
      observaciones: observacionesDeEntrega(f.observaciones, noCobro, items.length > 0 ? f.motivoDevolucion : null),
      cobro: lineas.length > 0 ? { imputacion: f.imputacion, lineas } : undefined,
      firma: f.firmaUrl ? { fotoUrl: f.firmaUrl } : undefined,
      devolucion: items.length > 0 ? { items } : undefined,
    },
  }
}

/** Código del 409 cuando la clave ya registró otra cosa (el mismo que el alta de venta y el cobro). */
const CLAVE_CON_OTRO_CUERPO = 'ClaveIdempotenciaConOtroCuerpo'

export type FalloEntrega =
  /** La clave ya se usó en otra parada: no se registró nada, hay que mandar una clave nueva. */
  | { tipo: 'claveUsada'; mensaje: string }
  /** La parada ya estaba registrada (un intento anterior llegó, quizás con otros datos): manda lo del servidor. */
  | { tipo: 'yaRegistrada'; mensaje: string }
  | { tipo: 'error'; mensaje: string }

/** Qué hacer con un rechazo de `entregar`. El 409 de la clave lleva siempre el mismo código: el mensaje dice cuál es. */
export function clasificarFalloEntrega(e: unknown): FalloEntrega {
  const mensaje = mensajeDelServidor(e, 'No se pudo registrar la entrega.')
  const { status, codigo } = (e ?? {}) as { status?: number; codigo?: string }
  if (status !== 409) return { tipo: 'error', mensaje }
  if (codigo === CLAVE_CON_OTRO_CUERPO && /otra entrega/i.test(mensaje)) return { tipo: 'claveUsada', mensaje }
  if (codigo === CLAVE_CON_OTRO_CUERPO || /ya fue reportada/i.test(mensaje)) return { tipo: 'yaRegistrada', mensaje }
  return { tipo: 'error', mensaje }
}

/** Kilómetros del recorrido como los dice el servidor: "850 m", "12,3 km". */
export function formatDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`
  return `${(metros / 1000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
}

/**
 * Por qué el botón de confirmar está apagado (patrón "deshabilitado con la razón", PermPatrones panel 2).
 * La foto del remito exigida no apaga el botón: al tocarlo `armarEntrega` explica el faltante, como siempre.
 */
export function razonPendiente(ctx: { entregado: boolean; receptor: string; motivo: string | null; subiendo: boolean }): string | null {
  if (ctx.subiendo) return 'Subiendo la foto: esperá un momento'
  if (ctx.entregado) return ctx.receptor.trim() ? null : 'Falta quién recibió'
  return ctx.motivo ? null : 'Falta elegir el motivo'
}
