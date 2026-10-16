import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/core/api/client'
import type { ChequeListDto, ChequeListDtoPaginatedResponse } from '@/libs/api-client/types'
import { cuentasKeys } from '@/features/cuentas/api/queries'

export type ChequeEnCartera = ChequeListDto
type Pagina = ChequeListDtoPaginatedResponse

/** Roles que operan la cartera de cheques en el servidor (además de MOD_PAGOS:Update). */
export const ROLES_CARTERA = ['Administrador', 'AdministradorSistemas', 'Gerencia'] as const

const chequesKeys = { cartera: ['cheques', 'cartera'] as const }

/** Cheques de terceros en cartera, de a 100 por página (los que se pueden depositar). */
export function useChequesEnCartera() {
  return useInfiniteQuery({
    queryKey: chequesKeys.cartera,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get<Pagina>(`/api/v1/cheques?Estado=EnCartera&Tipo=Tercero&PageNumber=${pageParam}&PageSize=100`),
    getNextPageParam: ultima => (ultima.hasNextPage ? (ultima.page ?? 1) + 1 : undefined),
  })
}

export interface ResultadoDeposito {
  cheque: ChequeEnCartera
  error: unknown | null
}

/**
 * Un servidor anterior al depósito por lote no tiene la ruta: 404 (o 405 si la toma por otra), sin
 * cuerpo. El servidor nuevo también contesta 404 cuando un cheque o la cuenta ya no existen, pero con
 * su sobre de error (`errors` siempre viene): eso es un rechazo del lote, no un servidor viejo, y
 * depositar de a uno dejaría depositados unos sí y otros no.
 */
const sinDepositoPorLote = (e: unknown) =>
  e instanceof ApiError && (e.status === 404 || e.status === 405) && e.errors === undefined && e.codigo === undefined

/** El camino viejo: una llamada por cheque, en serie, sin cortar a la mitad. */
async function depositarDeAUno(cheques: ChequeEnCartera[], cuentaDestinoId: string) {
  const resultados: ResultadoDeposito[] = []
  for (const cheque of cheques) {
    try {
      await api.post(`/api/v1/cheques/${cheque.id}/depositar`, { chequeId: cheque.id, cuentaDestinoId })
      resultados.push({ cheque, error: null })
    } catch (error) {
      resultados.push({ cheque, error })
    }
  }
  return resultados
}

/**
 * Deposita los cheques elegidos en una sola llamada (`POST /cheques/depositar`): todo o nada. Si el
 * servidor rechaza el lote (409, con cuál cheque y por qué), no se depositó ninguno y todos llevan
 * ese mismo error. Solo con un servidor que no tiene la ruta cae al depósito de a uno. Nunca tira.
 */
export function useDepositarCheques() {
  const qc = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async ({ cheques, cuentaDestinoId }: { cheques: ChequeEnCartera[]; cuentaDestinoId: string }) => {
      try {
        await api.post('/api/v1/cheques/depositar', { chequeIds: cheques.map(k => k.id), cuentaDestinoId })
        return cheques.map((cheque): ResultadoDeposito => ({ cheque, error: null }))
      } catch (error) {
        if (sinDepositoPorLote(error)) return depositarDeAUno(cheques, cuentaDestinoId)
        return cheques.map((cheque): ResultadoDeposito => ({ cheque, error }))
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: chequesKeys.cartera })
      qc.invalidateQueries({ queryKey: cuentasKeys.all })
    },
  })
}
