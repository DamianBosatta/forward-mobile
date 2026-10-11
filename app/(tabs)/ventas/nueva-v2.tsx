import React from 'react'
import { Redirect } from 'expo-router'
import { useVentaNueva } from '@/features/ventas/lib/ventaNueva'
import { VentaNuevaPantalla } from '@/features/venta-nueva/components/VentaNuevaPantalla'

/** Venta nueva (9A, fase 2): ruta propia para no tocar ventas/nueva; sin el switch lleva a esa. */
export default function NuevaVentaV2Route() {
  const ventaNueva = useVentaNueva()
  if (!ventaNueva) return <Redirect href="/(tabs)/ventas/nueva" />
  return <VentaNuevaPantalla />
}
