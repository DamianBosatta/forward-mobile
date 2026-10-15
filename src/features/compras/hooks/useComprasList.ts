import { useEffect, useMemo, useState } from 'react'
import { useBorradoresCompraMios, useComprasResumen, useInfiniteCompras } from '@/libs/api-client/compras'
import { itemsCargados, totalDelServidor, textoContador } from '@/features/listas/lib/contador'
import { fechaDesdePeriodo, type PeriodoVentas } from '@/features/ventas/hooks/useVentasListaNueva'
import { formatImporte } from '@/core/ui/fw/formatImporte'
import { useAlLlegarFiltro, type EstadoCompraRuta } from '@/features/listas/lib/filtroDeRuta'
import type { CompraDtoList, EstadoCompra } from '@/libs/api-client'

export type PestanaCompras = 'pendientes' | 'recibidas' | 'borradores'
export type PeriodoCompras = PeriodoVentas

/** Qué estados trae cada pestaña: el filtro lo aplica el servidor (`Estados`). */
const ESTADOS: Record<Exclude<PestanaCompras, 'borradores'>, EstadoCompra[]> = {
  pendientes: ['NotaPedido', 'Confirmado'],
  recibidas: ['Entregado'],
}
const ESPERA_BUSQUEDA_MS = 300

const mismosEstados = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((e) => b.includes(e))

/** Los pesos con el signo, como el resto de la app; otra moneda con su código (`USD 1.200,00`). */
const importeEn = (moneda: string, total: number) =>
  moneda === 'ARS' ? formatImporte(total) : formatImporte(total).replace('$', moneda)

/**
 * Lista de compras con el formato nuevo (Bloque 9A, PR 3.1). Pestaña, período y búsqueda van al
 * servidor; nada se filtra sobre las páginas cargadas, así que "Mostrando N de M" vale siempre.
 * `estadoDeRuta` (una fila de Inicio): Pendientes con uno solo de sus dos estados.
 */
export function useComprasList(estadoDeRuta: EstadoCompraRuta | null = null) {
  const [pestana, setPestana] = useState<PestanaCompras>('pendientes')
  /** Dentro de Pendientes, uno solo de sus estados; null = los dos. */
  const [soloEstado, setSoloEstado] = useState<EstadoCompraRuta | null>(estadoDeRuta)
  // Lo pendiente no vence por antigüedad: por defecto se ve todo.
  const [periodo, setPeriodo] = useState<PeriodoCompras>('todo')
  const [busqueda, setBusqueda] = useState('')
  const [busquedaEnviada, setBusquedaEnviada] = useState('')

  // Sin espera, cada tecla cambiaba las keys de la lista y del resumen.
  useEffect(() => {
    const t = setTimeout(() => setBusquedaEnviada(busqueda.trim()), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(t)
  }, [busqueda])
  useAlLlegarFiltro(estadoDeRuta, (e) => {
    setPestana('pendientes')
    setSoloEstado(e)
    setPeriodo('todo')
    setBusqueda('')
    setBusquedaEnviada('')
  })

  const esBorradores = pestana === 'borradores'
  const fechaDesde = fechaDesdePeriodo(periodo)
  const searchTerm = busquedaEnviada.length >= 2 ? busquedaEnviada : undefined

  const estados = pestana === 'pendientes' && soloEstado ? [soloEstado] : ESTADOS[esBorradores ? 'pendientes' : pestana]
  const compras = useInfiniteCompras({ pageSize: 20, estados, fechaDesde, searchTerm }, { enabled: !esBorradores })
  const { data: resumen, refetch: refetchResumen } = useComprasResumen({ fechaDesde, searchTerm, estados })
  const borradores = useBorradoresCompraMios(esBorradores)

  const items = useMemo(() => itemsCargados<CompraDtoList>(compras.data?.pages), [compras.data])
  const porMoneda = resumen?.totalesPorMoneda
  const importesTexto = porMoneda?.length ? porMoneda.map((t) => importeEn(t.moneda, t.total)).join(' · ') : null
  // El servidor nuevo dice con qué estados recortó el importe: si son los de la pestaña, va junto
  // al contador (9B, prioridad 3). El anterior ignora `Estados` y no lo dice.
  const recortadoPorPestana = !!resumen?.estadosTotalesPorMoneda && mismosEstados(resumen.estadosTotalesPorMoneda, estados)
  const contador = textoContador(
    items.length, totalDelServidor(compras.data?.pages), recortadoPorPestana ? (importesTexto ?? formatImporte(0)) : null,
  )

  // Del servidor o nada: sin resumen no se muestra un número que podría estar mal.
  const resumenTexto = !resumen ? null
    : pestana === 'pendientes' ? `${resumen.notasPedido} notas de pedido · ${resumen.confirmadas} por recibir`
    : pestana === 'recibidas' ? `${resumen.entregadas} recibidas`
    : null

  // Servidor que no recorta por pestaña: el total comprado cubre las dos pestañas, así que va en
  // otra línea. El que no lo separa por moneda tampoco: no se muestra.
  const compradoTexto = !recortadoPorPestana && importesTexto
    ? `Comprado (pendientes y recibidas): ${importesTexto}`
    : null

  return {
    pestana, setPestana,
    soloEstado, setSoloEstado,
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
