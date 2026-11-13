import { Inbox, PackageCheck, PackageOpen, RotateCcw, type LucideIcon } from 'lucide-react-native'
import type { ChipEstado } from '@/libs/theme'
import type { ConteosPreparacion, VentaPreparacion } from '@/libs/api-client/logistica'
import type { components } from '@/libs/api-client/generated/schema'
import { resolverEstadoVenta } from '@/libs/reglas/estados'
import { diaArgentina, partesArgentina } from '@/core/utils/fecha'
import { moverDia } from '@/features/calendario/semana'

/**
 * Lo que trae `ventas-para-preparacion` para una tarjeta del tablero. El tipo de mobile no tiene el último
 * cambio; se suma desde el contrato (X14), sin interfaz escrita a mano.
 */
export type VentaTablero = VentaPreparacion & Partial<Pick<components['schemas']['VentaPreparacionDto'], 'ultimoCambioPor' | 'ultimoCambioEn'>>

export type ColumnaId = 'aPreparar' | 'enPreparacion' | 'empacados' | 'noEntregado'

/**
 * Título, ícono, color y estado de cada columna, como `COLUMNAS_TABLERO` de la web (ColumnaHeader.tsx): ámbar a
 * preparar, azul en preparación, verde empacados, rojo no entregado. El color sale de los chips de estado de mobile.
 * `estado` es el nombre del EstadoVenta (X11: por nombre, nunca por número).
 */
export const COLUMNAS: ReadonlyArray<{ id: ColumnaId; titulo: string; icono: LucideIcon; tono: ChipEstado; estado: string; vacia: string }> = [
  { id: 'aPreparar', titulo: 'A preparar', icono: Inbox, tono: 'porAutorizar', estado: 'Confirmada', vacia: 'No hay pedidos a preparar.' },
  { id: 'enPreparacion', titulo: 'En preparación', icono: PackageOpen, tono: 'enCurso', estado: 'EnPreparacion', vacia: 'Ningún pedido en preparación.' },
  { id: 'empacados', titulo: 'Empacados', icono: PackageCheck, tono: 'entregado', estado: 'Empacada', vacia: 'Todavía no hay pedidos empacados.' },
  { id: 'noEntregado', titulo: 'No entregado', icono: RotateCcw, tono: 'anulado', estado: 'NoEntregada', vacia: 'No hay entregas fallidas. Buen trabajo.' },
]

export type Columnas = Record<ColumnaId, VentaTablero[]>

/** Reparte los pedidos en las cuatro columnas por el nombre del estado; los de otro estado no se muestran (como la web). */
export function repartirEnColumnas(ventas: readonly VentaTablero[]): Columnas {
  const r: Columnas = { aPreparar: [], enPreparacion: [], empacados: [], noEntregado: [] }
  for (const v of ventas) {
    const nombre = resolverEstadoVenta(v.estado)?.nombre
    const col = COLUMNAS.find((c) => c.estado === nombre)
    if (col) r[col.id].push(v)
  }
  return r
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/**
 * Subtotal bajo el título de la columna, como la web: unidades en A preparar y En preparación, piezas en
 * Empacados y "Hay que reprogramar" en No entregado. Un servidor anterior sin `unidadesCount` suma cero.
 */
export function subtotalDeColumna(id: ColumnaId, items: readonly VentaTablero[]): string {
  if (id === 'noEntregado') return 'Hay que reprogramar'
  if (id === 'empacados') return plural(items.reduce((s, v) => s + v.piezasCount, 0), 'pieza', 'piezas')
  return `${items.reduce((s, v) => s + (v.unidadesCount ?? 0), 0)} unidades`
}

/** Pedidos y productos del día: las tres columnas de trabajo; los no entregados tienen su columna y no suman. */
export function totalDelDia(columnas: Columnas): { pedidos: number; productos: number } {
  const delDia = [...columnas.aPreparar, ...columnas.enPreparacion, ...columnas.empacados]
  return { pedidos: delDia.length, productos: delDia.reduce((s, v) => s + v.itemsCount, 0) }
}

/** "Hoy · 2 pedidos · 8 productos": el total de lo que muestra el tablero para el día o rango elegido. */
export function textoTotalDelDia(etiqueta: string, t: { pedidos: number; productos: number }): string {
  return `${etiqueta} · ${plural(t.pedidos, 'pedido', 'pedidos')} · ${plural(t.productos, 'producto', 'productos')}`
}

/**
 * Cantidad de cada pestaña: la que cuenta el servidor (`preparacion/conteos`, `clave` = nombre del estado). Sin
 * respuesta devuelve null y la pestaña va sin número, nunca con uno contado en el teléfono (como "Pedidos de logística").
 */
export function conteosDeColumnas(conteos: ConteosPreparacion | undefined): Record<ColumnaId, number> | null {
  if (!conteos) return null
  const r = {} as Record<ColumnaId, number>
  for (const col of COLUMNAS) {
    r[col.id] = conteos.columnas
      .filter((c) => resolverEstadoVenta(c.clave)?.nombre === col.estado)
      .reduce((s, c) => s + c.cantidad, 0)
  }
  return r
}

/** Si la entrega ya pasó, por el día de negocio argentino (`hoy`, YYYY-MM-DD), nunca el reloj del aparato (X9). */
export function estaAtrasado(fechaEntrega: string | null | undefined, hoy: string): boolean {
  if (!fechaEntrega) return false
  const ms = Date.parse(fechaEntrega)
  if (Number.isNaN(ms)) return false
  return diaArgentina(ms) < hoy
}

const SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const dos = (n: number) => String(n).padStart(2, '0')

/** "lun 9/11", el día de entrega en Argentina. */
export function diaCorto(fecha: string): string | null {
  const ms = Date.parse(fecha)
  if (Number.isNaN(ms)) return null
  const p = partesArgentina(ms)
  return `${SEMANA[p.diaSemana]} ${p.dia}/${p.mes + 1}`
}

/** "Operario · 11/11 10:42": quién y cuándo cambió el pedido por última vez; null sin datos. */
export function textoUltimoCambio(v: Pick<VentaTablero, 'ultimoCambioPor' | 'ultimoCambioEn'>): string | null {
  const ms = v.ultimoCambioEn ? Date.parse(v.ultimoCambioEn) : NaN
  const p = Number.isNaN(ms) ? null : partesArgentina(ms)
  const cuando = p ? `${dos(p.dia)}/${dos(p.mes + 1)} ${dos(p.hora)}:${dos(p.minuto)}` : null
  const partes = [v.ultimoCambioPor, cuando].filter((x): x is string => !!x)
  return partes.length > 0 ? partes.join(' · ') : null
}

/** Método de entrega como la web (MetodoBadge): Logística, Retiro o Expreso. */
export function etiquetaMetodo(metodo: number, nombre: string): string {
  return metodo === 1 ? 'Logística' : metodo === 2 ? 'Retiro' : metodo === 3 ? 'Expreso' : nombre
}

/** Los atajos de entrega de la web (rango-entrega.ts). `''` = sin límite: no viaja. */
export type AtajoEntrega = 'hoy' | 'manana' | 'semana' | 'todo'
export interface RangoEntrega { desde: string; hasta: string }

export const ATAJOS_ENTREGA: ReadonlyArray<{ id: AtajoEntrega; label: string }> = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'manana', label: 'Mañana' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'todo', label: 'Todo' },
]

/** "Esta semana" son hoy y los seis días que siguen, no la semana calendario (como la web). */
export function rangoDeAtajo(atajo: AtajoEntrega, hoy: string): RangoEntrega {
  const mas = (n: number) => moverDia(hoy, n).fecha
  switch (atajo) {
    case 'hoy': return { desde: hoy, hasta: hoy }
    case 'manana': return { desde: mas(1), hasta: mas(1) }
    case 'semana': return { desde: hoy, hasta: mas(6) }
    case 'todo': return { desde: '', hasta: '' }
  }
}

/** Qué atajo describe un rango, o null si es uno exacto: se deriva, no se guarda aparte. */
export function atajoDeRango(rango: RangoEntrega, hoy: string): AtajoEntrega | null {
  return ATAJOS_ENTREGA.find(({ id }) => {
    const r = rangoDeAtajo(id, hoy)
    return r.desde === rango.desde && r.hasta === rango.hasta
  })?.id ?? null
}

/** Métodos del filtro, como la web: Todos, Logística, Retiro, Expreso. */
export const METODOS: ReadonlyArray<{ valor: number | null; label: string }> = [
  { valor: null, label: 'Todos' },
  { valor: 1, label: 'Logística' },
  { valor: 2, label: 'Retiro' },
  { valor: 3, label: 'Expreso' },
]
