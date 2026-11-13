import React from 'react'
import { RequirePermission } from '@/core/ui'
import { PorPrepararScreen } from '@/features/logistica/porPreparar/PorPrepararScreen'
import { useRefrescarAlEnfocar } from '@/core/hooks/useRefrescarAlEnfocar'

/** Pedidos de logística: pendientes y no entregados, solo ver (D6). Igual que la web: MOD_VIAJES leer, sin rol. */
export default function PedidosLogisticaRoute() {
  useRefrescarAlEnfocar()
  return (
    <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
      <PorPrepararScreen />
    </RequirePermission>
  )
}
