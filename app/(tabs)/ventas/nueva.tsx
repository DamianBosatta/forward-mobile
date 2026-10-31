import React, { useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
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

/**
 * Venta nueva: la única venta, para todos. La pantalla vive en el drawer y no se desmonta sola: cada venta
 * (otros parámetros, o una grabada) se monta de cero con `key`, así no queda la anterior en Revisar ni su clave
 * de idempotencia. Al terminar también se vacían los parámetros, para que "Nueva venta" no reabra un duplicado.
 */
export default function NuevaVentaRoute() {
  const params = useLocalSearchParams<Params>()
  const router = useRouter()
  const [vez, setVez] = useState(0)
  const alTerminar = () => {
    setVez((v) => v + 1)
    router.setParams({ borrador: undefined, tipo: undefined, editar: undefined, duplicar: undefined, clienteId: undefined })
  }
  const clave = `${vez}:${params.borrador ?? ''}:${params.editar ?? ''}:${params.duplicar ?? ''}:${params.clienteId ?? ''}`
  return <VentaNuevaPantalla key={clave} abrir={abrirDesdeParams(params)} clienteId={params.clienteId} alTerminar={alTerminar} />
}
