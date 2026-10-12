import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import { CompraNueva } from '@/features/compras/components/CompraNueva'

/**
 * Ruta `compras/nueva`: la compra nueva y retomar un borrador (`?borrador=`) usan el formato nuevo
 * (Bloque 9A, PR 3.2). Editar una compra guardada (`?edit=`) usa el mismo formulario nuevo, sin
 * autoguardado y con un solo "Guardar cambios" (Bloque 9B).
 */
export default function NuevaCompraRoute() {
  const { edit, borrador } = useLocalSearchParams<{ edit?: string; borrador?: string }>()
  if (edit) return <CompraNueva key={`edit-${edit}`} editarId={edit} />
  return <CompraNueva key={borrador ?? 'nueva'} borradorId={borrador} />
}
