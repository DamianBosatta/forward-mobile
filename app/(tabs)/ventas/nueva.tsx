import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import { VentaNuevaPantalla, type AbrirVenta } from '@/features/venta-nueva/components/VentaNuevaPantalla'

type Params = { borrador?: string; tipo?: string; editar?: string; duplicar?: string; clienteId?: string }

/**
 * `?borrador=<id>&tipo=…` retoma un borrador; `?editar=<id>` edita una venta; `?duplicar=<id>` parte de una.
 * `?clienteId=<id>` (Vender de nuevo, Buscar, la ficha del cliente) empieza una venta nueva ya con ese cliente.
 */
export function abrirDesdeParams(p: Params): AbrirVenta | undefined {
  if (p.borrador) return { modo: 'retomar', ventaId: p.borrador, tipo: p.tipo === 'Presupuesto' ? 'Presupuesto' : 'Pedido' }
  if (p.editar) return { modo: 'editar', ventaId: p.editar }
  if (p.duplicar) return { modo: 'duplicar', ventaId: p.duplicar }
  return undefined
}

/** Venta nueva: la única venta, para todos. */
export default function NuevaVentaRoute() {
  const params = useLocalSearchParams<Params>()
  return <VentaNuevaPantalla abrir={abrirDesdeParams(params)} clienteId={params.clienteId} />
}
