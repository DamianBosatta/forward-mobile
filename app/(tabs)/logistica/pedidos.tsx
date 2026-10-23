import React from 'react'
import { RequirePermission } from '@/core/ui'
import { PorPrepararScreen } from '@/features/logistica/porPreparar/PorPrepararScreen'

/** Pedidos de logística: pendientes y no entregados, solo ver (D6). Igual que la web: MOD_VIAJES leer, sin rol. */
export default function PedidosLogisticaRoute() {
  return (
    <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
      <PorPrepararScreen />
    </RequirePermission>
  )
}
