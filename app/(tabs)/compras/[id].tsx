import React, { useState } from 'react'
import { idDeRuta, useParametrosDeRuta } from '@/core/navigation/parametrosDeRuta'
import { tomarAviso } from '@/features/compras/lib/confirmar-y-recibir'
import { CompraDetalle } from '@/features/compras/components/CompraDetalle'

// La lista (panel derecho en tablet) y los tests la importan desde acá.
export { CompraDetalle }

/** Ruta `compras/[id]`: el id viene de la URL. */
export default function CompraDetailScreen() {
  // `aviso`: clave del resultado de confirmar y recibir desde la compra nueva. El texto se toma de
  // memoria (lo dejó esa pantalla); un enlace con la clave sola no muestra nada.
  const { id, aviso } = useParametrosDeRuta({ id: idDeRuta, aviso: idDeRuta })
  const [inicial] = useState(() => (id ? tomarAviso(id, aviso) : null))
  if (!id) return null
  return <CompraDetalle id={id} aviso={inicial ?? undefined} />
}
