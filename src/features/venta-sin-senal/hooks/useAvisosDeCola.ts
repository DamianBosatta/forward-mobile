import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { gestorStock, type GestorStock } from '@/core/realtime/stockEnVivo'
import { useStockEnVivo } from '@/core/realtime/useStockEnVivo'
import { CLAVE_CATALOGO, useCatalogoVenta } from '@/features/venta-nueva/hooks/useCatalogoVenta'
import { lineasQueCambiaron, type LineaCambiada } from '../lib/cambiosEnCola'
import type { VentaEnCola } from '../lib/cola'

const DEPOSITOS = [DEPOSITO_CENTRAL_ID]

/**
 * Las líneas de las ventas guardadas en el teléfono que cambiaron de stock (F4, S3). Al (re)conectar vuelve a pedir
 * el catálogo (el stock de ahora) y compara. Solo avisa: el envío no espera.
 */
export function useAvisosDeCola(cola: VentaEnCola[], gestor: GestorStock = gestorStock): LineaCambiada[] {
  const qc = useQueryClient()
  const { productos } = useCatalogoVenta('')
  const alRefrescar = useCallback(() => { void qc.invalidateQueries({ queryKey: CLAVE_CATALOGO }) }, [qc])
  const { enVivo } = useStockEnVivo({ depositoIds: DEPOSITOS, alRefrescar, alCambio: alRefrescar, gestor })
  // Sin cantidades (sin la capacidad) el catálogo trae ceros: no hay con qué comparar.
  const compara = enVivo && gestor.veCantidades()
  return useMemo(() => (compara ? lineasQueCambiaron(cola, productos) : []), [compara, cola, productos])
}
