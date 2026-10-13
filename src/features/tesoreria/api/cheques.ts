import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/core/api/client'
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
 * El servidor deposita de a un cheque: una llamada por cheque, una detrás de otra. Nunca corta a
 * la mitad ni tira: devuelve cuáles se depositaron y cuáles no, con el motivo de cada uno.
 */
export function useDepositarCheques() {
  const qc = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async ({ cheques, cuentaDestinoId }: { cheques: ChequeEnCartera[]; cuentaDestinoId: string }) => {
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
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: chequesKeys.cartera })
      qc.invalidateQueries({ queryKey: cuentasKeys.all })
    },
  })
}
