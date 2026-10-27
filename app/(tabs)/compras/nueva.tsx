import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import { CompraNueva } from '@/features/compras/components/CompraNueva'

/**
 * Ruta `compras/nueva`: la compra nueva y retomar un borrador (`?borrador=`) usan el formato nuevo
 * (Bloque 9A, PR 3.2). Editar una compra guardada (`?edit=`) usa el mismo formulario nuevo, sin
 * autoguardado y con un solo "Guardar cambios" (Bloque 9B). Con `?proveedor=` (desde la ficha del
 * proveedor) la compra nueva arranca con ese proveedor ya elegido.
 */
export default function NuevaCompraRoute() {
  const { edit, borrador, proveedor } = useLocalSearchParams<{ edit?: string; borrador?: string; proveedor?: string }>()
  if (edit) return <CompraNueva key={`edit-${edit}`} editarId={edit} />
  return <CompraNueva key={borrador ?? proveedor ?? 'nueva'} borradorId={borrador} proveedorId={proveedor} />
}
