import React from 'react'
import { idDeRuta, useParametrosDeRuta } from '@/core/navigation/parametrosDeRuta'
import { ClienteForm } from '@/features/clientes/components/ClienteForm'

/** Alta y edición de cliente. Lo tipeado se conserva al salir por el menú lateral y volver; cambiar de registro la rearma. */
export default function ClienteFormScreen() {
  const { id } = useParametrosDeRuta({ id: idDeRuta })
  return <ClienteForm key={id ?? 'nuevo'} id={id || undefined} />
}
