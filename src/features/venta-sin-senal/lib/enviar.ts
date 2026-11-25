import { api, ApiError } from '@/core/api/client'
import { esError, mensajeDeError, totalCambiadoDe } from '@/core/api/errores'
import { TOPE_DE_INTENTOS, avisoDeTope, fallosDelTopeTras } from '@/core/utils/colasSinSenal'
import { guardarBorradorVenta, type BorradorVenta, type VistaPreviaVenta } from '@/libs/api-client/ventas'
import type { VentaActionResponseDto, VentaDetalleDto } from '@/libs/api-client/types'
import type { components } from '@/libs/api-client/generated/schema'
import { resolverEstadoVenta } from '@/libs/reglas/estados'
import { redondear2 } from '@/libs/reglas/dinero'
import type { AltaVenta, AutoguardadoVenta } from '@/features/venta-nueva/lib/payload'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { cambiarEstado, leerCola, llevaIva, type FaseEnvio, type VentaEnCola } from './cola'

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

/**
 * La cola es de un usuario y `api` manda el token de quien está en sesión ahora: si entró otro en el
 * mismo teléfono, no se manda nada más de esta cola hasta que vuelva el dueño.
 */
const enSesion = (usuarioId: string) => useAuthStore.getState().user?.id === usuarioId

/** Cortó porque cambió el usuario: la venta queda como estaba, sin contar un intento. */
class SesionCambiada extends Error {}

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

  private exigirSesion() {
    if (!enSesion(this.usuarioId)) throw new SesionCambiada()
  }

  /** Guarda el paso ANTES de la llamada que lo sigue: si la app muere en el medio, se retoma de acá. */
  private pasar(fase: FaseEnvio, totalEsperado?: number) {
    const a = this.actual()
    const previo = a?.estado.tipo === 'esperando' ? a.estado : undefined
    cambiarEstado(this.usuarioId, this.venta.clave, {
      tipo: 'esperando', fase, intentos: previo?.intentos ?? 0, fallosDelTope: previo?.fallosDelTope,
    }, totalEsperado)
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
      if (e instanceof SesionCambiada) return false
      if (esTransitoria(e)) {
        const a = this.actual()
        if (a?.estado.tipo !== 'esperando') return false
        const intentos = a.estado.intentos + 1
        const fallosDelTope = fallosDelTopeTras(a.estado.fallosDelTope, e)
        if (fallosDelTope < TOPE_DE_INTENTOS) {
          cambiarEstado(this.usuarioId, this.venta.clave, { ...a.estado, intentos, fallosDelTope })
          return false
        }
        // Tope: deja de reintentarse sola para no trabar a las de atrás. Guarda la fase: pudo haberse grabado, y
        // "Enviar ahora" la retoma desde ahí con la misma clave (`reintentarVenta`).
        cambiarEstado(this.usuarioId, this.venta.clave, {
          tipo: 'revisar', mensaje: avisoDeTope('Tocá «Enviar ahora» para probar de nuevo.'), fase: a.estado.fase,
        })
        return true
      }
      // Error de la venta (validación o negocio: lo dicen el status y el código): no se reintenta sola.
      cambiarEstado(this.usuarioId, this.venta.clave, { tipo: 'revisar', mensaje: mensajeDeError(e, POR_DEFECTO) })
      return true
    }
  }

  /** Lo decide el servidor: si rechazaría la venta, para revisar; si el precio cambió, a Borradores; si no, el alta. */
  private async conVistaPrevia() {
    this.exigirSesion()
    // Con factura la vista previa no lleva `totalEsperado`: el que hubiera es el neto (o ninguno) y la vista previa lo ignora.
    const { totalEsperado: _neto, ...sinTotal } = this.venta.alta
    const conIva = llevaIva(this.venta.alta)
    const vp = await api.post<VistaPreviaVenta>('/api/v1/Ventas/vista-previa', conIva ? sinTotal : this.venta.alta)
    if (vp.rechazos?.length) {
      cambiarEstado(this.usuarioId, this.venta.clave, { tipo: 'revisar', mensaje: vp.rechazos.join('\n') })
      return
    }
    const totalServidor = vp.total ?? null
    // Con factura también cuenta el neto: si no es el que vio el vendedor, no se manda sola (un `totalNeto` ausente: el total es el neto).
    const netoDistinto = conIva && redondear2(vp.totalNeto ?? vp.total ?? Number.NaN) !== redondear2(this.venta.visto.total)
    if (netoDistinto || cambioElPrecio(this.venta.visto.precios, vp.lineas ?? [])) {
      const desde = Date.now()
      this.pasar({ paso: 'creandoBorrador', desde, totalServidor })
      await this.crearBorrador(desde, totalServidor, false)
      return
    }
    // Con factura el total del servidor se guarda con la venta ANTES del POST: el reintento sale con el mismo cuerpo y la misma clave.
    this.pasar({ paso: 'altaEnviada' }, conIva && typeof vp.total === 'number' ? redondear2(vp.total) : undefined)
    await this.darDeAlta(true)
  }

  /**
   * POST /Ventas, siempre con la misma clave: con ella el servidor devuelve la venta que ya existe.
   * `cotizada`: la vista previa corrió en esta ronda justo antes (un 409 ahora ya no se vuelve a cotizar).
   */
  private async darDeAlta(cotizada = false) {
    let r: VentaActionResponseDto
    this.exigirSesion()
    // Lo guardado manda: con factura el total se agregó a la venta recién antes de este POST.
    const { alta } = this.actual() ?? this.venta
    try {
      r = await api.post<VentaActionResponseDto>('/api/v1/Ventas', alta)
    } catch (e) {
      const cambiado = totalCambiadoDe(e)
      if (cambiado) {
        // Con factura el cuerpo salió con el neto que vio el vendedor y el 409 es lo esperable: la venta seguro no se grabó, así
        // que se cotiza una vez (misma clave: el 409 la liberó). Precios iguales se manda con el total del servidor; si no, Borradores.
        if (llevaIva(alta) && !cotizada) {
          this.pasar({ paso: 'nueva' })
          await this.conVistaPrevia()
          return
        }
        // No se grabó: queda en Borradores con el precio de hoy, igual que si la vista previa hubiera avisado.
        const desde = Date.now()
        this.pasar({ paso: 'creandoBorrador', desde, totalServidor: cambiado.total })
        await this.crearBorrador(desde, cambiado.total, false)
        return
      }
      const grabada = ventaYaGrabada(e)
      if (!grabada) throw e
      r = grabada
    }
    // El código (A00419) no viene en la respuesta del alta: se lee la venta; si no se puede, queda sin código.
    const detalle = enSesion(this.usuarioId)
      ? await api.get<VentaDetalleDto>(`/api/v1/Ventas/${r.ventaId}`).catch(() => null)
      : null
    const estado = resolverEstadoVenta(r.estado ?? detalle?.venta?.estado)?.nombre ?? null
    cambiarEstado(this.usuarioId, this.venta.clave, {
      tipo: 'enviada', ventaId: r.ventaId, codigo: detalle?.venta?.codigoPedido ?? null, estado,
      ...(llevaIva(alta) && typeof alta.totalEsperado === 'number' ? { total: alta.totalEsperado } : {}),
    })
  }

  /**
   * Borrador para revisar (POST /Ventas/borradores, el mismo del autoguardado). Su alta lleva una
   * clave por venta encolada (`<clave>-borrador`); además, si un intento anterior quedó sin respuesta, primero se busca el borrador vacío de este
   * cliente que nació desde entonces, para no dejar otro huérfano.
   */
  private async crearBorrador(desde: number, totalServidor: number | null, buscarAntes: boolean) {
    const { alta } = this.venta
    const tipo = tipoDeBorrador(alta)
    let creado: { ventaId: string; version: number } | undefined
    if (buscarAntes) {
      this.exigirSesion()
      const mios = await api.get<BorradorVenta[]>('/api/v1/Ventas/borradores/mios')
      const previo = (Array.isArray(mios) ? mios : []).find((b) =>
        b.clienteId === alta.clienteId && b.cantidadLineas === 0 && (b.tipoOperacion ?? tipo) === tipo
        && Date.parse(b.fechaModificacion) >= desde - TOLERANCIA_RELOJ_MS)
      if (previo) creado = { ventaId: previo.id, version: previo.version }
    }
    if (!creado) {
      this.exigirSesion()
      creado = await api.post<VentaActionResponseDto>('/api/v1/Ventas/borradores', {
        clienteId: alta.clienteId, depositoId: alta.depositoId, tipoOperacion: tipo,
        // Una clave por venta encolada: el reintento del alta del borrador (sin respuesta) la repite y el servidor devuelve el mismo borrador.
        claveIdempotencia: `${alta.claveIdempotencia}-borrador`,
      })
    }
    this.pasar({ paso: 'borradorCreado', ventaId: creado.ventaId, version: creado.version, totalServidor })
    await this.cargarBorrador(creado.ventaId, creado.version, totalServidor)
  }

  /** PUT de las líneas. El cuerpo es siempre el mismo: si la versión cambió (un PUT anterior sin respuesta), se relee y se repite. */
  private async cargarBorrador(ventaId: string, version: number, totalServidor: number | null) {
    const cuerpo = { ...aBorrador(this.venta.alta) }
    this.exigirSesion()
    try {
      await guardarBorradorVenta(ventaId, version, cuerpo)
    } catch (e) {
      if (!esError(e, 'Concurrencia')) throw e
      this.exigirSesion()
      const detalle = await api.get<VentaDetalleDto>(`/api/v1/Ventas/${ventaId}`)
      await guardarBorradorVenta(ventaId, detalle.venta.version, cuerpo)
    }
    cambiarEstado(this.usuarioId, this.venta.clave, { tipo: 'enBorradores', ventaId, totalServidor })
  }
}

/** El estado guardado de una venta, para comparar (`null`: ya no está en la cola). */
const estadoGuardado = (usuarioId: string, clave: string) =>
  JSON.stringify(leerCola(usuarioId).find((v) => v.clave === clave)?.estado ?? null)

async function ronda(usuarioId: string): Promise<ResultadoRonda> {
  // Cómo dejó la ronda cada venta que ya resolvió: no se vuelve a mandar salvo que su estado cambie después
  // (`reintentarVenta` durante la ronda la vuelve a esperar y sale en esta misma ronda).
  const resueltas = new Map<string, string>()
  // Se relee la cola en cada vuelta: lo que se encola (o se retoma) durante la ronda también sale, en orden.
  for (;;) {
    const sig = leerCola(usuarioId).find((v) => v.estado.tipo === 'esperando' && resueltas.get(v.clave) !== JSON.stringify(v.estado))
    if (!sig || sig.estado.tipo !== 'esperando') return resueltas.size ? 'completa' : 'vacia'
    if (!enSesion(usuarioId)) return 'sinSenal'
    // Sin señal se corta acá: las de atrás esperan su turno, para no adelantarse a la que no salió.
    if (!(await new Envio(usuarioId, sig).ejecutar(sig.estado.fase))) return 'sinSenal'
    resueltas.set(sig.clave, estadoGuardado(usuarioId, sig.clave))
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
