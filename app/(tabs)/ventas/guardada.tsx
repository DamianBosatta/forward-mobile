import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import { VentaGuardadaPantalla } from '@/features/venta-nueva/components/VentaGuardadaPantalla'

/** Venta guardada (9A, PR 2.9): a dónde lleva confirmar en la venta nueva. */
export default function VentaGuardadaRoute() {
  const { id, mensaje } = useLocalSearchParams<{ id: string; mensaje?: string }>()
  return <VentaGuardadaPantalla id={id} mensaje={mensaje} />
}
