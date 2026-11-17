import React from 'react'
import { idDeRuta, useParametrosDeRuta } from '@/core/navigation/parametrosDeRuta'
import { DetalleVenta } from '@/features/ventas/components/DetalleVenta'

/** Ruta `ventas/[id]`: el id viene de la URL. */
export default function VentaDetailScreen() {
  const { id } = useParametrosDeRuta({ id: idDeRuta })
  return id ? <DetalleVenta id={id} /> : null
}
