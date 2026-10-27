import React from 'react'
import { ConAccesosRapidos } from '@/src/components/layout/AccesosRapidos'
import { useFiltroVentasDeRuta } from '@/features/listas/lib/filtroDeRuta'
import { ListaVentasNueva } from '@/features/ventas/components/ListaVentasNueva'
import { DetalleVenta } from '@/features/ventas/components/DetalleVenta'

/** Pantalla principal: en teléfono lleva la barra de accesos rápidos (Bloque 9A, PR 0.3). */
export default function VentasListScreenRoute() {
  // Las filas de Inicio llegan con el filtro en la ruta (?tipo=…&estado=…).
  const filtroDeRuta = useFiltroVentasDeRuta()
  return (
    <ConAccesosRapidos activa="ventas">
      <ListaVentasNueva filtroDeRuta={filtroDeRuta} detalle={(id, cerrar) => <DetalleVenta key={id} id={id} onVolver={cerrar} />} />
    </ConAccesosRapidos>
  )
}
