import React, { useState } from 'react'
import { idDeRuta, useParametrosDeRuta } from '@/core/navigation/parametrosDeRuta'
import { CompraGuardadaPantalla } from '@/features/compras/components/CompraGuardadaPantalla'
import { tomarAviso } from '@/features/compras/lib/confirmar-y-recibir'

/**
 * Ruta `compras/guardada?id=&aviso=`: "Compra guardada" después de confirmar, guardar la nota de pedido o confirmar y
 * recibir desde la compra nueva. `aviso` es solo la clave; el texto lo dejó la compra nueva en memoria (un enlace con la
 * clave sola no muestra un éxito que no pasó).
 */
export default function CompraGuardadaRoute() {
  const { id, aviso } = useParametrosDeRuta({ id: idDeRuta, aviso: idDeRuta })
  const [inicial] = useState(() => (id ? tomarAviso(id, aviso) : null))
  if (!id) return null
  return <CompraGuardadaPantalla id={id} aviso={inicial ?? undefined} />
}
