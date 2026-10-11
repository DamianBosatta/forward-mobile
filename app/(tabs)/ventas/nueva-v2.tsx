import React from 'react'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { useVentaNueva } from '@/features/ventas/lib/ventaNueva'
import { VentaNuevaPantalla } from '@/features/venta-nueva/components/VentaNuevaPantalla'

/**
 * Venta nueva (9A, fase 2): ruta propia para no tocar ventas/nueva; sin el switch lleva a esa.
 * `?borrador=<id>&tipo=Pedido|Presupuesto` retoma un borrador del servidor.
 */
export default function NuevaVentaV2Route() {
  const ventaNueva = useVentaNueva()
  const { borrador, tipo } = useLocalSearchParams<{ borrador?: string; tipo?: string }>()
  if (!ventaNueva) return <Redirect href="/(tabs)/ventas/nueva" />
  const retomar = borrador ? { borradorId: borrador, tipo: tipo === 'Presupuesto' ? 'Presupuesto' as const : 'Pedido' as const } : undefined
  return <VentaNuevaPantalla retomar={retomar} />
}
