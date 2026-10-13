import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/core/api/client'
import { sociosKeys } from '@/libs/api-client/socios'
import type { GetMovimientosCuentaDto, TipoCuentaSocio } from '@/libs/api-client/types'
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
}

const esTipoCuenta = (t: unknown): t is TipoCuentaSocio => t === 'Tst' || t === 'Normal'

/** Código del 409 cuando la clave ya registró otro cobro (el mismo que el alta de venta, forward-system #867). */
export const CLAVE_CON_OTRO_CUERPO = 'ClaveIdempotenciaConOtroCuerpo'

/** El id del pago que quedó grabado con esa clave: el 409 lo trae en `data` (`PagoRegistradoResponse.ConOtroCuerpo`). */
const pagoConOtroCuerpo = (e: unknown): string | null =>
  e instanceof ApiError && e.status === 409 && e.codigo === CLAVE_CON_OTRO_CUERPO && typeof e.data === 'string' && e.data ? e.data : null

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
        const grabado = pagoConOtroCuerpo(e)
        if (!grabado) throw e
        return { pagoId: grabado, tipoCuenta: null, conLoDeAntes: true }
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
