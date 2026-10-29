import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { CatalogoStockItem } from '@/libs/api-client'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { conStockFresco, stockCambiado, type CambioDeStock } from '../lib/avisoStockVivo'
import { useCarritoVenta } from './useCarritoVenta'
import { CLAVE_CATALOGO } from './useCatalogoVenta'

type Cache = { items: CatalogoStockItem[] } | CatalogoStockItem[]
const SIN_CATALOGO: CatalogoStockItem[] = []
const itemsDe = (d: Cache | undefined): CatalogoStockItem[] => (Array.isArray(d) ? d : d?.items ?? [])

/**
 * Revalidación del stock al revisar la venta (S6, "Mostrar y revalidar"): al abrir, y cada vez que se llama a
 * `revalidar()` (antes de confirmar), vuelve a pedir el catálogo y marca las líneas cuyo stock cambió contra lo que
 * se vio al cargarlas. Lee las líneas del carrito (la foto de la carga, sin el stock fresco encima) y devuelve
 * `lineas` ya con el stock fresco. No reserva stock ni bloquea: solo informa; el servidor decide al guardar.
 *
 * `cambios` sigue al catálogo: también marca lo que llega por el stock en vivo (`useStockVivoVenta` parcha la misma
 * caché). `confirmado` es true solo si el último pedido llegó al servidor y salió bien; `sinConexion`, si quedó en pausa
 * por falta de red (ahí no se afirma nada del stock: se revisa al enviar).
 */
export function useRevalidarStockVenta() {
  const qc = useQueryClient()
  const lineasCarrito = useCarritoVenta((s) => s.lineas)
  const verCantidades = hasCapability(useAuthStore((s) => s.user?.permissions), 'CAP_VER_CANTIDADES_STOCK')
  const [revalidando, setRevalidando] = useState(false)
  const [confirmado, setConfirmado] = useState(false)
  const [sinConexion, setSinConexion] = useState(false)
  // Observa la caché del catálogo: `staleTime` infinito para no pedirlo por su cuenta (lo hace `revalidar`). Tiene que
  // estar activo: `refetchQueries` se salta las consultas cuyos observadores están todos desactivados.
  const { data } = useQuery<Cache, Error, CatalogoStockItem[]>({ queryKey: CLAVE_CATALOGO, staleTime: Infinity, select: itemsDe })
  const catalogo = data ?? SIN_CATALOGO

  const cambios = useMemo(() => stockCambiado(lineasCarrito, catalogo, verCantidades), [lineasCarrito, catalogo, verCantidades])
  const lineas = useMemo(() => conStockFresco(lineasCarrito, catalogo), [lineasCarrito, catalogo])

  // Siempre las últimas líneas, sin que `revalidar` cambie con cada edición del carrito.
  const ultimas = useRef({ lineasCarrito, verCantidades })
  ultimas.current = { lineasCarrito, verCantidades }

  const revalidar = useCallback(async (): Promise<CambioDeStock[]> => {
    setRevalidando(true)
    try {
      await qc.refetchQueries({ queryKey: CLAVE_CATALOGO })
      // `refetchQueries` no tira: si falló, el estado de la consulta queda en error y la caché con lo anterior.
      // Sin conexión tampoco espera: el pedido queda en pausa (`fetchStatus: 'paused'`) y `status` sigue en 'success'
      // por lo que había en caché; eso no es haber llegado al servidor.
      const estado = qc.getQueryState(CLAVE_CATALOGO)
      const enPausa = estado?.fetchStatus === 'paused'
      setSinConexion(enPausa)
      setConfirmado(!enPausa && estado?.status === 'success')
      const { lineasCarrito: ls, verCantidades: ver } = ultimas.current
      return stockCambiado(ls, itemsDe(qc.getQueryData<Cache>(CLAVE_CATALOGO)), ver)
    } finally {
      setRevalidando(false)
    }
  }, [qc])

  useEffect(() => { void revalidar() }, [revalidar])

  return { lineas, cambios, confirmado, sinConexion, revalidando, revalidar }
}
