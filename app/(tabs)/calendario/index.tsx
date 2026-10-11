import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import { CalendarioScreen } from '@/features/calendario/CalendarioScreen'

/** Calendario (PR 5.3). "Agendar" desde una venta llega con título, descripción y número. */
export default function CalendarioRoute() {
  const { titulo, descripcion, origen, nonce } = useLocalSearchParams<{ titulo?: string; descripcion?: string; origen?: string; nonce?: string }>()
  const precarga = titulo ? { titulo, descripcion, origen } : null
  return <CalendarioScreen key={`${titulo ?? ''}|${origen ?? ''}|${nonce ?? ''}`} precarga={precarga} />
}
