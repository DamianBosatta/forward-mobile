import { useMemo } from 'react'
import { useVenta } from '@/libs/api-client/ventas'
import { useSocio } from '@/libs/api-client/socios'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useCatalogoVenta } from './useCatalogoVenta'
import { ventaCargada, type VentaCargada } from '../lib/hidratar'

/**
 * Trae del servidor lo necesario para abrir una venta en la pantalla de venta: la venta, su
 * cliente (para nombrarlo por la dirección) y el catálogo de venta. Sin `id` no pide nada; con `activo` en false (ya hidratada) no vuelve a pedir.
 */
export function useVentaCargada(id: string | undefined, activo = true): { datos: VentaCargada | null; cargando: boolean; error: string | null } {
  // Solo vale la venta traída al abrir: el caché viejo tiene líneas y versión de antes (el próximo guardado daría 409).
  const venta = useVenta(id ?? '', { fresco: true, activo })
  const socio = useSocio(venta.data?.venta.clienteId ?? '')
  const catalogo = useCatalogoVenta('')
  const vigente = venta.isFetchedAfterMount && venta.isSuccess ? venta.data : undefined
  const datos = useMemo(
    () => (vigente && socio.data && !catalogo.isLoading ? ventaCargada(vigente, socio.data, catalogo.productos) : null),
    [vigente, socio.data, catalogo.isLoading, catalogo.productos],
  )
  if (!id) return { datos: null, cargando: false, error: null }
  const fallo = venta.error ?? socio.error
  return {
    datos,
    cargando: !datos && !fallo,
    error: fallo ? mensajeDelServidor(fallo, 'No se pudo abrir la venta.') : null,
  }
}
