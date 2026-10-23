import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { gestorStock, type CambioProducto, type GestorStock, type MensajeStock } from '@/core/realtime/stockEnVivo'
import { useStockEnVivo } from '@/core/realtime/useStockEnVivo'
import { stockKeys } from '@/libs/api-client'
import type { LineaCarrito } from '../lib/carrito'
import { aplicarCambiosAlCatalogo, avisoDeStock } from '../lib/avisoStockVivo'
import { CLAVE_CATALOGO } from './useCatalogoVenta'

const DEPOSITOS = [DEPOSITO_CENTRAL_ID]

/**
 * Stock en vivo de la venta nueva (F4, S1/S2): mantiene fresco el catálogo que muestra la venta y avisa,
 * por línea, cuando cambia el stock de un producto ya cargado. Avisa y deja seguir: no bloquea nada.
 */
export function useStockVivoVenta(lineas: LineaCarrito[], gestor: GestorStock = gestorStock) {
  const qc = useQueryClient()
  // Lo último que llegó de cada producto.
  const [cambios, setCambios] = useState<Record<string, CambioProducto>>({})

  const alRefrescar = useCallback(() => {
    // Lo que cambió con la conexión cortada no se avisó: se vuelve a pedir y los avisos viejos ya no valen.
    setCambios({})
    void qc.invalidateQueries({ queryKey: CLAVE_CATALOGO })
    void qc.invalidateQueries({ queryKey: stockKeys.all })
  }, [qc])

  const alCambio = useCallback((m: MensajeStock) => {
    setCambios((previos) => ({ ...previos, ...Object.fromEntries(m.productos.map((p) => [p.productoId, p])) }))
    if (m.productos.every((p) => p.disponible !== undefined)) {
      qc.setQueryData(CLAVE_CATALOGO, (d: Parameters<typeof aplicarCambiosAlCatalogo>[0] | undefined) => (d ? aplicarCambiosAlCatalogo(d, m.productos) : d))
    } else {
      // Sin números no hay qué poner en la fila: se vuelve a pedir.
      void qc.invalidateQueries({ queryKey: CLAVE_CATALOGO })
    }
  }, [qc])

  const { enVivo } = useStockEnVivo({ depositoIds: DEPOSITOS, alRefrescar, alCambio, gestor })

  const avisos = useMemo(() => {
    const r: Record<string, string> = {}
    for (const l of lineas) {
      const c = cambios[l.productoId]
      const texto = c ? avisoDeStock(c, l) : null
      if (texto) r[l.productoId] = texto
    }
    return r
  }, [lineas, cambios])

  return { enVivo, avisos }
}
