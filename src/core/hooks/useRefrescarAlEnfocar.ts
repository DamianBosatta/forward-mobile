import { useCallback, useRef } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router/react-navigation'
import { refrescarVencidas } from '@/libs/api-client/invalidaciones'

/**
 * Al volver a una pantalla que quedó montada (volver atrás, cambiar de pestaña), vuelve a pedir lo que
 * muestra si ya venció (`staleTime`). No hace nada en el primer foco (la pantalla recién montada ya
 * pide sus datos) ni con lo que sigue fresco. `claves` son las raíces de las consultas de la pantalla;
 * sin ellas se refresca toda consulta activa vencida.
 */
export function useRefrescarAlEnfocar(claves?: readonly QueryKey[]): void {
  const queryClient = useQueryClient()
  const primerFoco = useRef(true)
  const llave = JSON.stringify(claves ?? null)
  // `llave` es la identidad de `claves`: así un arreglo nuevo en cada render no re-dispara el efecto.
  const clavesRef = useRef(claves)
  clavesRef.current = claves
  useFocusEffect(
    useCallback(() => {
      if (primerFoco.current) {
        primerFoco.current = false
        return
      }
      void refrescarVencidas(queryClient, clavesRef.current)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryClient, llave]),
  )
}
