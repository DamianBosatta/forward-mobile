import React from 'react'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { CompraNueva } from '@/features/compras/components/CompraNueva'

/**
 * Ruta `compras/nueva`: la compra nueva y retomar un borrador (`?borrador=`) usan el formato nuevo
 * (Bloque 9A, PR 3.2). Editar una compra guardada (`?edit=`) ya no existe en el teléfono: el
 * formulario de antes perdía el descuento y la unidad de compra (BACKLOG-9B), así que cualquier
 * enlace viejo vuelve al detalle de la compra.
 */
export default function NuevaCompraRoute() {
  const { edit, borrador } = useLocalSearchParams<{ edit?: string; borrador?: string }>()
  if (edit) return <Redirect href={`/(tabs)/compras/${edit}` as never} />
  return <CompraNueva key={borrador ?? 'nueva'} borradorId={borrador} />
}
