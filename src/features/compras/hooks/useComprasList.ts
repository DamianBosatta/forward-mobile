import { useEffect, useMemo, useState } from 'react'
import { useBorradoresCompraMios, useComprasResumen, useInfiniteCompras } from '@/libs/api-client/compras'
import { itemsCargados, totalDelServidor, textoContador } from '@/features/listas/lib/contador'
import { fechaDesdePeriodo, type PeriodoVentas } from '@/features/ventas/hooks/useVentasListaNueva'
import { formatImporte } from '@/core/ui/fw/formatImporte'
import type { CompraDtoList, EstadoCompra } from '@/libs/api-client'

export type PestanaCompras = 'pendientes' | 'recibidas' | 'borradores'
export type PeriodoCompras = PeriodoVentas

/** Qué estados trae cada pestaña: el filtro lo aplica el servidor (`Estados`). */
const ESTADOS: Record<Exclude<PestanaCompras, 'borradores'>, EstadoCompra[]> = {
  pendientes: ['NotaPedido', 'Confirmado'],
  recibidas: ['Entregado'],
}
const ESPERA_BUSQUEDA_MS = 300

/** Los pesos con el signo, como el resto de la app; otra moneda con su código (`USD 1.200,00`). */
const importeEn = (moneda: string, total: number) =>
  moneda === 'ARS' ? formatImporte(total) : formatImporte(total).replace('$', moneda)

/**
 * Lista de compras con el formato nuevo (Bloque 9A, PR 3.1). Pestaña, período y búsqueda van al
 * servidor; nada se filtra sobre las páginas cargadas, así que "Mostrando N de M" vale siempre.
 */
export function useComprasList() {
  const [pestana, setPestana] = useState<PestanaCompras>('pendientes')
  // Lo pendiente no vence por antigüedad: por defecto se ve todo.
  const [periodo, setPeriodo] = useState<PeriodoCompras>('todo')
  const [busqueda, setBusqueda] = useState('')
  const [busquedaEnviada, setBusquedaEnviada] = useState('')

  // Sin espera, cada tecla cambiaba las keys de la lista y del resumen.
  useEffect(() => {
    const t = setTimeout(() => setBusquedaEnviada(busqueda.trim()), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(t)
  }, [busqueda])

  const esBorradores = pestana === 'borradores'
  const fechaDesde = fechaDesdePeriodo(periodo)
  const searchTerm = busquedaEnviada.length >= 2 ? busquedaEnviada : undefined

  const compras = useInfiniteCompras(
    { pageSize: 20, estados: ESTADOS[esBorradores ? 'pendientes' : pestana], fechaDesde, searchTerm },
    { enabled: !esBorradores },
  )
  const { data: resumen, refetch: refetchResumen } = useComprasResumen({ fechaDesde, searchTerm })
  const borradores = useBorradoresCompraMios(esBorradores)

  const items = useMemo(() => itemsCargados<CompraDtoList>(compras.data?.pages), [compras.data])
  const contador = textoContador(items.length, totalDelServidor(compras.data?.pages))

  // Del servidor o nada: sin resumen no se muestra un número que podría estar mal.
  const resumenTexto = !resumen ? null
    : pestana === 'pendientes' ? `${resumen.notasPedido} notas de pedido · ${resumen.confirmadas} por recibir`
    : pestana === 'recibidas' ? `${resumen.entregadas} recibidas`
    : null

  // El total comprado, una cifra por moneda. Cubre las dos pestañas (el resumen no filtra por
  // estado), así que no va junto al contador. El servidor viejo no lo separa: no se muestra.
  const porMoneda = resumen?.totalesPorMoneda
  const compradoTexto = porMoneda?.length
    ? `Comprado (pendientes y recibidas): ${porMoneda.map((t) => importeEn(t.moneda, t.total)).join(' · ')}`
    : null

  return {
    pestana, setPestana,
    periodo, setPeriodo,
    busqueda, setBusqueda,
    compras: items,
    contador,
    resumenTexto,
    compradoTexto,
    comprasQuery: compras,
    /** Deslizar para actualizar trae de nuevo la lista y su resumen. */
    refrescar: () => Promise.all([compras.refetch(), refetchResumen()]),
    borradores: borradores.data ?? [],
    borradoresQuery: borradores,
  }
}
