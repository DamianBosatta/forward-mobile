import React, { useState } from 'react'
import { idDeRuta, useParametrosDeRuta } from '@/core/navigation/parametrosDeRuta'
import { VentaGuardadaPantalla } from '@/features/venta-nueva/components/VentaGuardadaPantalla'
import { tomarMensajeDeVenta } from '@/features/venta-nueva/lib/mensajeDeGuardada'

/**
 * Venta guardada (9A, PR 2.9): a dónde lleva confirmar en la venta nueva. El mensaje no viaja en el enlace
 * (SEG-11): la ruta trae la clave y el texto sale de memoria, dejado por la venta que se guardó.
 */
export default function VentaGuardadaRoute() {
  const { id, aviso } = useParametrosDeRuta({ id: idDeRuta, aviso: idDeRuta })
  const [mensaje] = useState(() => (id ? tomarMensajeDeVenta(id, aviso) : undefined))
  return id ? <VentaGuardadaPantalla id={id} mensaje={mensaje} /> : null
}
