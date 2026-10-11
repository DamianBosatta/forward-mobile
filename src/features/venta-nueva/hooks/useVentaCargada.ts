import { useMemo } from 'react'
import { useVenta } from '@/libs/api-client/ventas'
import { useSocio } from '@/libs/api-client/socios'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useCatalogoVenta } from './useCatalogoVenta'
import { ventaCargada, type VentaCargada } from '../lib/hidratar'

/**
 * Trae del servidor lo necesario para abrir una venta en la pantalla de venta: la venta, su
 * cliente (para nombrarlo por la dirección) y el catálogo de venta. Sin `id` no pide nada.
 */
export function useVentaCargada(id: string | undefined): { datos: VentaCargada | null; cargando: boolean; error: string | null } {
  const venta = useVenta(id ?? '')
  const socio = useSocio(venta.data?.venta.clienteId ?? '')
  const catalogo = useCatalogoVenta('')
  const datos = useMemo(
    () => (venta.data && socio.data && !catalogo.isLoading ? ventaCargada(venta.data, socio.data, catalogo.productos) : null),
    [venta.data, socio.data, catalogo.isLoading, catalogo.productos],
  )
  if (!id) return { datos: null, cargando: false, error: null }
  const fallo = venta.error ?? socio.error
  return {
    datos,
    cargando: !datos && !fallo,
    error: fallo ? mensajeDelServidor(fallo, 'No se pudo abrir la venta.') : null,
  }
}
