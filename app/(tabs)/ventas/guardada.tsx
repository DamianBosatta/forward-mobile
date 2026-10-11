import React from 'react'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { useVentaNueva } from '@/features/ventas/lib/ventaNueva'
import { VentaGuardadaPantalla } from '@/features/venta-nueva/components/VentaGuardadaPantalla'

/** Venta guardada (9A, PR 2.9): a dónde lleva confirmar en la venta nueva. Sin el switch, al detalle de hoy. */
export default function VentaGuardadaRoute() {
  const ventaNueva = useVentaNueva()
  const { id, mensaje } = useLocalSearchParams<{ id: string; mensaje?: string }>()
  if (!ventaNueva) return <Redirect href={`/(tabs)/ventas/${id}` as never} />
  return <VentaGuardadaPantalla id={id} mensaje={mensaje} />
}
