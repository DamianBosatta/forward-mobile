import React from 'react'
import { ConAccesosRapidos } from '@/src/components/layout/AccesosRapidos'
import { RequirePermission } from '@/core/auth/RequirePermission'
import { ListaCompras } from '@/features/compras/components/ListaCompras'
import { useEstadoCompraDeRuta } from '@/features/listas/lib/filtroDeRuta'
import { CompraDetalle } from './[id]'

/** Pantalla principal de Compras (Bloque 9A, PR 3.1): en teléfono lleva la barra de accesos rápidos. */
export default function ComprasListScreenRoute() {
  // Las filas de Inicio llegan con el estado en la ruta (?estado=NotaPedido o Confirmado).
  const estadoDeRuta = useEstadoCompraDeRuta()
  return (
    <ConAccesosRapidos activa="compras">
      <RequirePermission module="MOD_COMPRAS" action="read" mode="screen">
        <ListaCompras estadoDeRuta={estadoDeRuta} detalle={(id, cerrar) => <CompraDetalle key={id} id={id} onVolver={cerrar} />} />
      </RequirePermission>
    </ConAccesosRapidos>
  )
}
