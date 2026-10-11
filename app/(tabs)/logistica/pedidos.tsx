import React from 'react'
import { RequirePermission } from '@/core/ui'
import { PorPrepararScreen } from '@/features/logistica/porPreparar/PorPrepararScreen'

/** Pedidos por preparar (PR 5.2): solo lectura, por fecha de entrega. */
export default function PedidosPorPrepararRoute() {
  return (
    <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
      <PorPrepararScreen />
    </RequirePermission>
  )
}
