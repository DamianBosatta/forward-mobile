import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { gestorStock, type GestorStock } from '@/core/realtime/stockEnVivo'
import { useStockEnVivo } from '@/core/realtime/useStockEnVivo'
import { useCatalogoVenta } from '@/features/venta-nueva/hooks/useCatalogoVenta'
import { useDepositoDeVenta } from '@/features/venta-nueva/hooks/useDepositoDeVenta'
import { lineasQueCambiaron, type LineaCambiada } from '../lib/cambiosEnCola'
import type { VentaEnCola } from '../lib/cola'
import { invalidarStock } from '@/libs/api-client/invalidaciones'

/**
 * Las líneas de las ventas guardadas en el teléfono que cambiaron de stock (F4, S3). Al (re)conectar vuelve a pedir
 * el catálogo (el stock de ahora) y compara. Solo avisa: el envío no espera.
 */
export function useAvisosDeCola(cola: VentaEnCola[], gestor: GestorStock = gestorStock): LineaCambiada[] {
  const qc = useQueryClient()
  const { productos } = useCatalogoVenta('')
  // El catálogo que se compara es el del depósito de la venta en pantalla (fuera de la venta, el propio): cada venta de
  // la cola se compara con el suyo y conserva el depósito con que se guardó; las de otro depósito no se comparan acá.
  const depositoDelCatalogo = useDepositoDeVenta()
  const deLaCola = useMemo(() => cola.filter((v) => (v.alta.depositoId ?? depositoDelCatalogo) === depositoDelCatalogo), [cola, depositoDelCatalogo])
  const depositos = useMemo(
    () => [...new Set([depositoDelCatalogo, ...cola.filter((v) => v.estado.tipo === 'esperando').map((v) => v.alta.depositoId).filter((d): d is string => !!d)])],
    [cola, depositoDelCatalogo],
  )
  const alRefrescar = useCallback(() => { void invalidarStock(qc) }, [qc])
  const { enVivo } = useStockEnVivo({ depositoIds: depositos, alRefrescar, alCambio: alRefrescar, gestor })
  // Sin cantidades (sin la capacidad) el catálogo trae ceros: se compara por `puedeVenderse`.
  const verCantidades = gestor.veCantidades()
  return useMemo(() => (enVivo ? lineasQueCambiaron(deLaCola, productos, verCantidades) : []), [enVivo, verCantidades, deLaCola, productos])
}
