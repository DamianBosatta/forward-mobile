import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import { DetalleVenta } from '@/features/ventas/components/DetalleVenta'

/** Ruta `ventas/[id]`: el id viene de la URL. */
export default function VentaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return id ? <DetalleVenta id={id} /> : null
}
