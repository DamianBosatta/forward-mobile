import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { logisticaKeys } from '@/libs/api-client/logistica'
import type { CuerpoCobroParada, CuerpoNoCobroParada } from './paradaCobro'

const URL_PARADA = (hojaDeRutaId: string, paradaCobroId: string) =>
  `/api/v1/Logistica/hojas-ruta/${hojaDeRutaId}/paradas-cobro/${paradaCobroId}`

interface Destino { hojaDeRutaId: string; paradaCobroId: string }

/**
 * Registra el cobro de una parada de solo cobro (S9). La clave de idempotencia viaja en el cuerpo: repetir el
 * mismo cuerpo devuelve lo ya registrado (`repetida`). Sin reintentos automáticos, como el cobro de la entrega.
 */
export function useCobrarParadaCobro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ hojaDeRutaId, paradaCobroId, cuerpo }: Destino & { cuerpo: CuerpoCobroParada }) =>
      api.post<unknown>(`${URL_PARADA(hojaDeRutaId, paradaCobroId)}/cobrar`, cuerpo),
    retry: false,
    onSuccess: (_, { hojaDeRutaId }) => { void qc.invalidateQueries({ queryKey: logisticaKeys.hojaRuta(hojaDeRutaId) }) },
  })
}

/** "No cobré" con su motivo obligatorio (S10). El mismo motivo repetido es 200; otro motivo es 409. */
export function useNoCobrarParadaCobro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ hojaDeRutaId, paradaCobroId, cuerpo }: Destino & { cuerpo: CuerpoNoCobroParada }) =>
      api.post<unknown>(`${URL_PARADA(hojaDeRutaId, paradaCobroId)}/no-cobrada`, cuerpo),
    retry: false,
    onSuccess: (_, { hojaDeRutaId }) => { void qc.invalidateQueries({ queryKey: logisticaKeys.hojaRuta(hojaDeRutaId) }) },
  })
}
