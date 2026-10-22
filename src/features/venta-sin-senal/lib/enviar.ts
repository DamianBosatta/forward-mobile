import { api, ApiError } from '@/core/api/client'
import { esError, mensajeDeError } from '@/core/api/errores'
import { guardarBorradorVenta, type BorradorVenta, type VistaPreviaVenta } from '@/libs/api-client/ventas'
import type { VentaActionResponseDto, VentaDetalleDto } from '@/libs/api-client/types'
import type { components } from '@/libs/api-client/generated/schema'
import { resolverEstadoVenta } from '@/libs/reglas/estados'
import { redondear2 } from '@/libs/reglas/dinero'
import type { AltaVenta, AutoguardadoVenta } from '@/features/venta-nueva/lib/payload'
import { cambiarEstado, leerCola, type FaseEnvio, type VentaEnCola } from './cola'

type VistaPreviaLineaDto = components['schemas']['VistaPreviaLineaDto']

/** `vacia`: no había nada que mandar; `completa`: se resolvió todo lo que esperaba; `sinSenal`: se cortó y se reintenta después. */
export type ResultadoRonda = 'vacia' | 'completa' | 'sinSenal'

/** La hora del servidor puede estar un poco corrida respecto de la del teléfono. */
const TOLERANCIA_RELOJ_MS = 2 * 60_000
const POR_DEFECTO = 'El servidor rechazó la venta.'

/**
 * Un fallo que no dice nada de la venta: no llegó (sin red, timeout), el servidor no respondió bien
 * (5xx), la sesión venció (401: se manda cuando vuelva a entrar), demasiados pedidos (429) u otro
 * intento con la misma clave se está grabando (409 `Duplicado`). La venta sigue esperando.
 */
function esTransitoria(e: unknown): boolean {
  if (!(e instanceof ApiError)) return true
  return e.status === 401 || e.status === 408 || e.status === 429 || e.status >= 500 || esError(e, 'Duplicado')
}

/** La clave ya grabó una venta (409 con la venta en `data`, forward-system #867): cuenta como enviada. */
function ventaYaGrabada(e: unknown): VentaActionResponseDto | null {
  if (!esError(e, 'ClaveIdempotenciaConOtroCuerpo')) return null
  const v = e.data as Partial<VentaActionResponseDto> | undefined
  return typeof v?.ventaId === 'string' && v.ventaId ? (v as VentaActionResponseDto) : null
}

/** ¿Algún precio del servidor no es el que vio el vendedor? Un producto sin precio visto también cuenta. */
export function cambioElPrecio(precios: Record<string, number>, lineas: VistaPreviaLineaDto[]): boolean {
  return lineas.some((l) => {
    const visto = precios[l.productoId]
    return visto === undefined || redondear2(visto) !== redondear2(l.precioBase)
  })
}

/** Las líneas y la cabecera del alta, con la forma del autoguardado (el borrador las recibe por PUT). */
function aBorrador(alta: AltaVenta): AutoguardadoVenta {
  const b: AutoguardadoVenta = {
    descuentoGeneral: alta.descuentoGeneral ?? 0,
    metodoEntrega: alta.metodoEntrega,
    items: (alta.items ?? []).map((i) => ({ productoId: i.productoId ?? '', cantidad: i.cantidad ?? 0, descuentoPorcentaje: i.descuentoPorcentaje ?? 0 })),
  }
  if (alta.fechaEntrega) b.fechaEntrega = alta.fechaEntrega
  if (alta.cargoFlete) b.cargoFlete = alta.cargoFlete
  if (alta.observaciones) b.observaciones = alta.observaciones
  return b
}

const tipoDeBorrador = (alta: AltaVenta): 'Pedido' | 'Presupuesto' => (alta.tipoOperacion === 2 ? 'Pedido' : 'Presupuesto')

/** El envío de UNA venta, retomado desde el paso que quedó guardado. */
class Envio {
  constructor(private usuarioId: string, private venta: VentaEnCola) {}

  private actual() {
    return leerCola(this.usuarioId).find((v) => v.clave === this.venta.clave)
  }

  /** Guarda el paso ANTES de la llamada que lo sigue: si la app muere en el medio, se retoma de acá. */
  private pasar(fase: FaseEnvio) {
    const a = this.actual()
    const intentos = a?.estado.tipo === 'esperando' ? a.estado.intentos : 0
    cambiarEstado(this.usuarioId, this.venta.clave, { tipo: 'esperando', fase, intentos })
  }

  /** true: quedó resuelta (enviada, en Borradores o para revisar); false: se cortó y sigue esperando. */
  async ejecutar(fase: FaseEnvio): Promise<boolean> {
    try {
      switch (fase.paso) {
        case 'nueva': await this.conVistaPrevia(); break
        case 'altaEnviada': await this.darDeAlta(); break
        case 'creandoBorrador': await this.crearBorrador(fase.desde, fase.totalServidor, true); break
        case 'borradorCreado': await this.cargarBorrador(fase.ventaId, fase.version, fase.totalServidor); break
      }
      return true
    } catch (e) {
      if (esTransitoria(e)) {
        const a = this.actual()
        if (a?.estado.tipo === 'esperando') {
          cambiarEstado(this.usuarioId, this.venta.clave, { ...a.estado, intentos: a.estado.intentos + 1 })
        }
        return false
      }
      // Error de la venta (validación o negocio: lo dicen el status y el código): no se reintenta sola.
      cambiarEstado(this.usuarioId, this.venta.clave, { tipo: 'revisar', mensaje: mensajeDeError(e, POR_DEFECTO) })
      return true
    }
  }

  /** Lo decide el servidor: si rechazaría la venta, para revisar; si el precio cambió, a Borradores; si no, el alta. */
  private async conVistaPrevia() {
    const vp = await api.post<VistaPreviaVenta>('/api/v1/Ventas/vista-previa', this.venta.alta)
    if (vp.rechazos?.length) {
      cambiarEstado(this.usuarioId, this.venta.clave, { tipo: 'revisar', mensaje: vp.rechazos.join('\n') })
      return
    }
    const totalServidor = vp.total ?? null
    if (cambioElPrecio(this.venta.visto.precios, vp.lineas ?? [])) {
      const desde = Date.now()
      this.pasar({ paso: 'creandoBorrador', desde, totalServidor })
      await this.crearBorrador(desde, totalServidor, false)
      return
    }
    this.pasar({ paso: 'altaEnviada' })
    await this.darDeAlta()
  }

  /** POST /Ventas, siempre con la misma clave: con ella el servidor devuelve la venta que ya existe. */
  private async darDeAlta() {
    let r: VentaActionResponseDto
    try {
      r = await api.post<VentaActionResponseDto>('/api/v1/Ventas', this.venta.alta)
    } catch (e) {
      const grabada = ventaYaGrabada(e)
      if (!grabada) throw e
      r = grabada
    }
    // El código (A00419) no viene en la respuesta del alta: se lee la venta; si no se puede, queda sin código.
    const detalle = await api.get<VentaDetalleDto>(`/api/v1/Ventas/${r.ventaId}`).catch(() => null)
    const estado = resolverEstadoVenta(r.estado ?? detalle?.venta?.estado)?.nombre ?? null
    cambiarEstado(this.usuarioId, this.venta.clave, {
      tipo: 'enviada', ventaId: r.ventaId, codigo: detalle?.venta?.codigoPedido ?? null, estado,
    })
  }

  /**
   * Borrador para revisar (POST /Ventas/borradores, el mismo del autoguardado). Su alta no lleva
   * clave: si un intento anterior quedó sin respuesta, primero se busca el borrador vacío de este
   * cliente que nació desde entonces, para no dejar otro huérfano.
   */
  private async crearBorrador(desde: number, totalServidor: number | null, buscarAntes: boolean) {
    const { alta } = this.venta
    const tipo = tipoDeBorrador(alta)
    let creado: { ventaId: string; version: number } | undefined
    if (buscarAntes) {
      const mios = await api.get<BorradorVenta[]>('/api/v1/Ventas/borradores/mios')
      const previo = (Array.isArray(mios) ? mios : []).find((b) =>
        b.clienteId === alta.clienteId && b.cantidadLineas === 0 && (b.tipoOperacion ?? tipo) === tipo
        && Date.parse(b.fechaModificacion) >= desde - TOLERANCIA_RELOJ_MS)
      if (previo) creado = { ventaId: previo.id, version: previo.version }
    }
    if (!creado) {
      creado = await api.post<VentaActionResponseDto>('/api/v1/Ventas/borradores', {
        clienteId: alta.clienteId, depositoId: alta.depositoId, tipoOperacion: tipo,
      })
    }
    this.pasar({ paso: 'borradorCreado', ventaId: creado.ventaId, version: creado.version, totalServidor })
    await this.cargarBorrador(creado.ventaId, creado.version, totalServidor)
  }

  /** PUT de las líneas. El cuerpo es siempre el mismo: si la versión cambió (un PUT anterior sin respuesta), se relee y se repite. */
  private async cargarBorrador(ventaId: string, version: number, totalServidor: number | null) {
    const cuerpo = { ...aBorrador(this.venta.alta) }
    try {
      await guardarBorradorVenta(ventaId, version, cuerpo)
    } catch (e) {
      if (!esError(e, 'Concurrencia')) throw e
      const detalle = await api.get<VentaDetalleDto>(`/api/v1/Ventas/${ventaId}`)
      await guardarBorradorVenta(ventaId, detalle.venta.version, cuerpo)
    }
    cambiarEstado(this.usuarioId, this.venta.clave, { tipo: 'enBorradores', ventaId, totalServidor })
  }
}

async function ronda(usuarioId: string): Promise<ResultadoRonda> {
  const vistas = new Set<string>()
  // Se relee la cola en cada vuelta: lo que se encola durante la ronda también sale, en orden.
  for (;;) {
    const sig = leerCola(usuarioId).find((v) => v.estado.tipo === 'esperando' && !vistas.has(v.clave))
    if (!sig || sig.estado.tipo !== 'esperando') return vistas.size ? 'completa' : 'vacia'
    vistas.add(sig.clave)
    // Sin señal se corta acá: las de atrás esperan su turno, para no adelantarse a la que no salió.
    if (!(await new Envio(usuarioId, sig).ejecutar(sig.estado.fase))) return 'sinSenal'
  }
}

const enCurso = new Map<string, Promise<ResultadoRonda>>()

/**
 * Manda, de a una y en el orden en que se encolaron, las ventas que esperan. Una sola ronda por
 * usuario a la vez: dos avisos de conexión juntos reciben la misma promesa y no mandan dos veces.
 */
export function enviarPendientes(usuarioId: string): Promise<ResultadoRonda> {
  const ya = enCurso.get(usuarioId)
  if (ya) return ya
  const p = ronda(usuarioId).finally(() => enCurso.delete(usuarioId))
  enCurso.set(usuarioId, p)
  return p
}
