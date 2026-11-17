import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import { ProveedorForm } from '@/features/proveedores/components/ProveedorForm'

/** Alta y edición de proveedor. Lo tipeado se conserva al salir por el menú lateral y volver; cambiar de registro la rearma. */
export default function ProveedorFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  return <ProveedorForm key={id ?? 'nuevo'} id={id || undefined} />
}
