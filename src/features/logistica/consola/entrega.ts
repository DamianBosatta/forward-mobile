import type { CuerpoEntregaParada, MedioCobroChofer } from '@/libs/api-client/logistica'
import type { components } from '@/libs/api-client/generated/schema'
import { leerNumero } from '@/core/utils/numero'
import { leerFecha } from '@/features/cuentas/lib/cobro'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'

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

/**
 * Lo que viaja en la línea: el monto que cargó el chofer, sin "Te dio" ni vuelto (S8). Si en efectivo cobra de más,
 * viaja todo y el servidor lo deja a favor en la cuenta del cliente.
 */
export function montoDeLinea(l: LineaCobroForm): number | null {
  return leerNumero(l.monto)
}

/** Solo observaciones del chofer y, si devuelve, el motivo de la devolución (TODO API: sin campo propio, viaja acá). */
export function observacionesDeEntrega(observaciones: string, motivoDevolucion?: string | null): string | undefined {
  return [motivoDevolucion ? `Devolución: ${motivoDevolucion}` : null, observaciones.trim()].filter(Boolean).join(' · ') || undefined
}

/** Lo que el chofer puede elegir para cobrar (S13). "No paga" no es un medio: no lleva líneas (S8). */
const TIPOS_DEL_CHOFER = ['Efectivo', 'Transferencia', 'Cheque'] as const

/**
 * Los medios del servidor que ve el chofer: uno por tipo, en orden fijo. El servidor manda dos de tipo Transferencia
 * ("Tarjeta / Billetera virtual" y "Transferencia bancaria"); el chofer ve una sola y viaja la bancaria (la billetera
 * se distingue por la foto). Sin nombre que coincida, el primero del tipo. Un servidor viejo todavía puede mandar Tarjeta.
 */
export function mediosDelChofer(medios: MedioCobroChofer[] | undefined): MedioCobroChofer[] {
  return TIPOS_DEL_CHOFER.flatMap((t) => {
    const deTipo = (medios ?? []).filter((m) => m.tipo === t)
    const elegido = t === 'Transferencia' ? deTipo.find((m) => /transferencia/i.test(m.nombre)) ?? deTipo[0] : deTipo[0]
    return elegido ? [elegido] : []
  })
}

/** Cómo lo ve el chofer: la transferencia se llama siempre "Transferencia", sea cual sea el nombre del servidor. */
export function nombreDelMedio(m: Pick<MedioCobroChofer, 'nombre' | 'tipo'>): string {
  return m.tipo === 'Transferencia' ? 'Transferencia' : m.nombre
}

/** Chofer-03--productos: por qué vuelve la mercadería. TODO API: sin campo propio por devolución, viaja en las observaciones. */
export const MOTIVOS_DEVOLUCION = ['Vencido', 'Roto o dañado', 'No lo pidió', 'Otro'] as const

export interface FormEntrega {
  receptor: string
  observaciones: string
  /** Foto del remito firmado, ya subida. */
  remitoUrl: string | null
  lineas: LineaCobroForm[]
  /** Cantidad devuelta por renglón (`ventaDetalleId` → texto del campo). */
  devolucion: Record<string, string>
  /** Solo viaja si hay devolución (observaciones, TODO API). */
  motivoDevolucion?: string | null
}

/** El cuerpo sin la clave: la clave la pone la consola, una por parada, para que los reintentos la repitan. */
export type EntregaArmada = Omit<CuerpoEntregaParada, 'claveIdempotencia'>

type LineaCobro = components['schemas']['LineaCobroEntregaInput']
type RenglonDevuelto = components['schemas']['NotaCreditoItemInput']

export function armarLinea(l: LineaCobroForm, n: number): { linea: LineaCobro } | { error: string } {
  if (!l.medio) return { error: `Elegí el medio del cobro ${n}.` }
  const monto = montoDeLinea(l)
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
  if (ctx.exigeFotoRemito && !f.remitoUrl) return { error: 'Falta la foto del remito firmado: sin ella no se cierra la entrega.' }

  const lineas: LineaCobro[] = []
  for (const [i, l] of f.lineas.entries()) {
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
      nombreReceptor: receptor || undefined,
      evidenciaUrl: f.remitoUrl ?? undefined,
      observaciones: observacionesDeEntrega(f.observaciones, items.length > 0 ? f.motivoDevolucion : null),
      cobro: lineas.length > 0 ? { imputacion: 'PedidoActual', lineas } : undefined,
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
export function razonPendiente(ctx: { entregado: boolean; motivo: string | null; subiendo: boolean }): string | null {
  if (ctx.subiendo) return 'Subiendo la foto: esperá un momento'
  if (ctx.entregado) return null
  return ctx.motivo ? null : 'Falta elegir el motivo'
}
