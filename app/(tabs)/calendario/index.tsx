import React from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CalendarioScreen } from '@/features/calendario/CalendarioScreen'

/** Calendario (PR 5.3). "Agendar" desde una venta llega con título, descripción, número e id de la venta. */
export default function CalendarioRoute() {
  const { titulo, descripcion, origen, ventaId, nonce } =
    useLocalSearchParams<{ titulo?: string; descripcion?: string; origen?: string; ventaId?: string; nonce?: string }>()
  const router = useRouter()
  const precarga = titulo ? { titulo, descripcion, origen, ventaId } : null
  return (
    <CalendarioScreen
      key={`${titulo ?? ''}|${origen ?? ''}|${nonce ?? ''}`}
      precarga={precarga}
      onAbrirVenta={(id) => router.push({ pathname: '/(tabs)/ventas/[id]', params: { id } })}
    />
  )
}
