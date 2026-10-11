import { useMemo } from 'react'
import { useVenta } from '@/libs/api-client/ventas'
import { useSocio } from '@/libs/api-client/socios'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useCatalogoVenta } from './useCatalogoVenta'
import { ventaCargada, type VentaCargada } from '../lib/hidratar'

/**
 * Trae del servidor lo necesario para abrir una venta en la pantalla de venta: la venta, su
 * cliente (para nombrarlo por la dirección) y el catálogo de venta. Sin `id` no pide nada; con `activo` en false (ya hidratada) no vuelve a pedir.
 * Sin catálogo no se hidrata: las líneas quedarían con los precios y el stock guardados en la venta
 * (y Duplicar promete los precios de hoy). Se muestra el error y `reintentar` vuelve a pedir lo que falló.
 */
export function useVentaCargada(id: string | undefined, activo = true): { datos: VentaCargada | null; cargando: boolean; error: string | null; reintentar: () => void } {
  // Solo vale la venta traída al abrir: el caché viejo tiene líneas y versión de antes (el próximo guardado daría 409).
  const venta = useVenta(id ?? '', { fresco: true, activo })
  const socio = useSocio(venta.data?.venta.clienteId ?? '')
  const catalogo = useCatalogoVenta('')
  const vigente = venta.isFetchedAfterMount && venta.isSuccess ? venta.data : undefined
  const datos = useMemo(
    () => (vigente && socio.data && catalogo.cargado ? ventaCargada(vigente, socio.data, catalogo.productos) : null),
    [vigente, socio.data, catalogo.cargado, catalogo.productos],
  )
  const reintentar = () => {
    if (venta.isError) void venta.refetch()
    if (socio.isError) void socio.refetch()
    if (catalogo.isError) void catalogo.reintentar()
  }
  if (!id) return { datos: null, cargando: false, error: null, reintentar }
  const fallo = venta.error ?? socio.error
  const error = fallo ? mensajeDelServidor(fallo, 'No se pudo abrir la venta.')
    : catalogo.isError ? 'No se pudo traer el catálogo con los precios y el stock de hoy.' : null
  return { datos, cargando: !datos && !error, error, reintentar }
}
