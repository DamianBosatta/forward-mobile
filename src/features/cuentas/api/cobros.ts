import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/core/api/client'
import { sociosKeys } from '@/libs/api-client/socios'
import type {
  CuentaCorrienteResumenDto, GetMovimientosCuentaDto, ImputacionMovimientoDto, MovimientoSocioDtoPaginatedResponse, SocioDetailDto, TipoCuentaSocio,
} from '@/libs/api-client/types'
import type { components } from '@/libs/api-client/generated/schema'
import { cuentasKeys } from './queries'
import type { CobroPayload } from '../lib/cobro'

export type MedioDePago = components['schemas']['MedioPagoResponse']

/** Medios de pago activos para un cobro (`GET /gastos/medios-pago`, pide MOD_PAGOS:Read). */
export function useMediosDeCobro() {
  return useQuery({
    queryKey: ['medios-pago', 'activos'],
    queryFn: () => api.get<MedioDePago[]>('/api/v1/gastos/medios-pago'),
    staleTime: 10 * 60_000,
  })
}

export type CajaAbierta = components['schemas']['CajaAbiertaEstadoDto']

/** Depósitos con la caja abierta, sin montos (`GET /Cajas/abiertas/estado`, pide MOD_PAGOS:Read). */
export function useCajasAbiertas(enabled: boolean) {
  return useQuery({
    queryKey: ['cajas', 'abiertas-estado'],
    enabled,
    queryFn: () => api.get<CajaAbierta[]>('/api/v1/Cajas/abiertas/estado'),
  })
}

/**
 * Cuentas propias donde puede entrar una transferencia o un depósito (`GET /cuentas-corrientes/propias`,
 * pide MOD_CC:Read). Ni la caja de efectivo ni la cartera de cheques: esos medios tienen su propio camino.
 */
export function useCuentasPropias(enabled: boolean) {
  return useQuery({
    queryKey: [...cuentasKeys.all, 'propias'],
    enabled,
    queryFn: () => api.get<CuentaCorrienteResumenDto[]>('/api/v1/cuentas-corrientes/propias'),
    select: (cuentas: CuentaCorrienteResumenDto[]) => cuentas.filter(c => c.activo && !c.esCuentaCajaEfectivo && !c.esCuentaCarteraCheques),
    staleTime: 10 * 60_000,
  })
}

export type DocumentoPendiente = components['schemas']['DocumentoPendienteDto']

/** Ventas y facturas con saldo del cliente, para la imputación manual (`GET /deudas/socios/{id}/pendientes`, MOD_PAGOS:Read). */
export function useDocumentosPendientes(socioId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...cuentasKeys.all, 'pendientes', socioId],
    enabled,
    queryFn: () => api.get<DocumentoPendiente[]>(`/api/v1/deudas/socios/${socioId}/pendientes?incluirFacturas=true`),
  })
}

type PagoRegistrado = components['schemas']['PagoRegistradoResponse']

/** Cobro registrado: el id del pago y la cuenta donde quedó, si el servidor la informa. */
export interface CobroRegistrado {
  /** `null` si un 2xx no trajo el id: el cobro se da por hecho, pero no se puede buscar su cuenta. */
  pagoId: string | null
  /** `null` si la respuesta no la trae (servidor anterior a forward-system #868): se busca en los movimientos. */
  tipoCuenta: TipoCuentaSocio | null
  /** El servidor ya tenía este cobro con esta clave y el mismo cuerpo (un reintento): devolvió el que había, no cargó otro. */
  yaEstaba?: boolean
  /**
   * La clave ya había registrado OTRO cobro (409 `ClaveIdempotenciaConOtroCuerpo`): lo de ahora no se cargó,
   * `pagoId` es el que quedó grabado. Pasa si se cambió el formulario después de un intento sin respuesta.
   */
  conLoDeAntes?: boolean
  /** El cobro se registró con esta clave y después se anuló (el mismo 409, con otro mensaje): no se cargó uno nuevo. */
  anulado?: boolean
  /** Lo que dijo el servidor, para mostrarlo tal cual cuando no hay un texto propio (cobro anulado). */
  aviso?: string
}

const esTipoCuenta = (t: unknown): t is TipoCuentaSocio => t === 'Tst' || t === 'Normal'

/** Código del 409 cuando la clave ya registró otro cobro (el mismo que el alta de venta, forward-system #867). */
export const CLAVE_CON_OTRO_CUERPO = 'ClaveIdempotenciaConOtroCuerpo'

const GUID_VACIO = '00000000-0000-0000-0000-000000000000'

/** 409 por la clave (forward-system #906): `data` es el id del pago que quedó grabado, o el Guid vacío si es de otro socio. */
const esConflictoDeClave = (e: unknown): e is ApiError =>
  e instanceof ApiError && e.status === 409 && e.codigo === CLAVE_CON_OTRO_CUERPO

/** El id del pago que quedó grabado con esa clave (otro cuerpo o anulado); null si el 409 no trae ninguno. */
const pagoGrabadoConLaClave = (e: unknown): string | null =>
  esConflictoDeClave(e) && typeof e.data === 'string' && e.data && e.data !== GUID_VACIO ? e.data : null

/**
 * La clave pertenece a un pago de OTRO socio (el servidor no devuelve ningún dato del pago): esa clave ya no
 * sirve para este cobro, la pantalla tiene que usar otra.
 */
export const claveDeOtroSocio = (e: unknown): boolean => esConflictoDeClave(e) && pagoGrabadoConLaClave(e) === null

/** El mensaje del servidor para el cobro anulado dice que «se anuló» (mismo código que el otro cuerpo). */
const dijoAnulado = (e: ApiError) => /anul/i.test(e.message)

/** El 200 de un reintento idéntico lo dice en el mensaje («…con esta clave de idempotencia (operación repetida)»). */
const esRepetido = (mensaje: unknown) => typeof mensaje === 'string' && /operaci[oó]n repetida/i.test(mensaje)

/**
 * Registra el cobro. Devuelve el id del pago y, desde forward-system #868, la cuenta que eligió el
 * servidor (`tipoCuenta`, en el sobre al lado de `data`). El cuerpo lleva una clave de idempotencia por
 * cobro (`CobroPayload.claveIdempotencia`): tocar de nuevo tras un corte la reusa y el servidor devuelve
 * el pago que ya tenía en vez de cargar otro. Sin reintentos automáticos: un servidor anterior ignora la
 * clave y repetir el pedido podría cargar el cobro dos veces.
 */
export function useRegistrarCobro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CobroPayload): Promise<CobroRegistrado> => {
      try {
        const r = await api.postConSobre<string | undefined, PagoRegistrado>('/api/v1/Finanzas/pagos/multilinea', payload)
        const tipo = r.sobre?.tipoCuenta
        return { pagoId: r.data ?? null, tipoCuenta: esTipoCuenta(tipo) ? tipo : null, yaEstaba: esRepetido(r.sobre?.message) }
      } catch (e) {
        // Otro cobro quedó grabado con esta clave: su sobre de error no trae la cuenta, se busca como con un servidor viejo.
        // La clave de otro socio (sin pago) es un error común: se muestra el motivo del servidor.
        const grabado = pagoGrabadoConLaClave(e)
        if (!grabado) throw e
        return (e as ApiError).message && dijoAnulado(e as ApiError)
          ? { pagoId: grabado, tipoCuenta: null, anulado: true, aviso: (e as ApiError).message }
          : { pagoId: grabado, tipoCuenta: null, conLoDeAntes: true }
      }
    },
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cuentasKeys.all })
      qc.invalidateQueries({ queryKey: sociosKeys.all })
    },
  })
}

/**
 * En qué cuenta del cliente quedó el cobro, según el servidor. Si el alta la informó, es esa. Si no
 * (servidor viejo), la cuenta cuyo movimiento lleva ese `pagoId`, en la primera página de cada una.
 */
export function useCuentaDelPago(cobro: CobroRegistrado, cuentas: { cuentaId?: string | null; cuentaNormalId?: string | null }) {
  const { pagoId, tipoCuenta } = cobro
  const buscada = useQuery({
    queryKey: [...cuentasKeys.all, 'cuenta-del-pago', pagoId],
    enabled: !tipoCuenta && !!pagoId,
    queryFn: async (): Promise<TipoCuentaSocio | null> => {
      const candidatas: [TipoCuentaSocio, string | null | undefined][] = [['Tst', cuentas.cuentaId], ['Normal', cuentas.cuentaNormalId]]
      for (const [tipo, id] of candidatas) {
        if (!id) continue
        const r = await api.get<GetMovimientosCuentaDto>(`/api/v1/cuentas-corrientes/${id}/movimientos?pageNumber=1&pageSize=20`)
        if (r.movimientos.items?.some(m => m.pagoId === pagoId)) return tipo
      }
      return null
    },
  })
  return { cuenta: tipoCuenta ?? buscada.data ?? null, buscando: !tipoCuenta && buscada.isLoading }
}

/**
 * A qué comprobantes se aplicó el cobro, según el servidor. `GET /Pagos/{id}` no sirve para un cobro a
 * ventas (sus conciliaciones no incluyen `ImputacionesPago`), así que se cruza el movimiento del pago en
 * su cuenta (que trae `pagoId`) con el mismo asiento de los movimientos del cliente (que trae `imputadoA`).
 * Null si no se puede saber (servidor anterior a #905, sin acceso o el asiento no está en la primera página).
 */
export function useImputadoDelPago(
  pagoId: string | null,
  cuenta: TipoCuentaSocio | null,
  cliente: Pick<SocioDetailDto, 'id' | 'cuentaId' | 'cuentaNormalId' | 'puedeVerCuentaCorriente'>,
) {
  const cuentaId = cuenta === 'Tst' ? cliente.cuentaId : cuenta === 'Normal' ? cliente.cuentaNormalId : null
  return useQuery({
    queryKey: [...cuentasKeys.all, 'imputado-del-pago', pagoId, cuenta],
    enabled: !!pagoId && !!cuentaId && !!cliente.puedeVerCuentaCorriente,
    retry: false,
    queryFn: async (): Promise<ImputacionMovimientoDto[] | null> => {
      const deLaCuenta = await api.get<GetMovimientosCuentaDto>(`/api/v1/cuentas-corrientes/${cuentaId}/movimientos?pageNumber=1&pageSize=20`)
      const asiento = deLaCuenta.movimientos.items?.find(m => m.pagoId === pagoId)
      if (!asiento) return null
      const delCliente = await api.get<MovimientoSocioDtoPaginatedResponse>(
        `/api/v1/cuentas-corrientes/socios/${cliente.id}/movimientos?pageNumber=1&pageSize=20&cuenta=${cuenta}`,
        { estadosEsperados: [404] },
      )
      return delCliente.items?.find(m => m.id === asiento.id)?.imputadoA ?? null
    },
  })
}
