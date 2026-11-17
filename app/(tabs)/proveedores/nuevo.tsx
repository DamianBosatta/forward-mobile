import React from 'react'
import { idDeRuta, useParametrosDeRuta } from '@/core/navigation/parametrosDeRuta'
import { ProveedorForm } from '@/features/proveedores/components/ProveedorForm'

/** Alta y edición de proveedor. Lo tipeado se conserva al salir por el menú lateral y volver; cambiar de registro la rearma. */
export default function ProveedorFormScreen() {
  const { id } = useParametrosDeRuta({ id: idDeRuta })
  return <ProveedorForm key={id ?? 'nuevo'} id={id || undefined} />
}
