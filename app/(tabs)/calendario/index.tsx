import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import { CalendarioScreen } from '@/features/calendario/CalendarioScreen'

/** Calendario (PR 5.3). "Agendar" desde una venta llega con título, descripción y número. */
export default function CalendarioRoute() {
  const { titulo, descripcion, origen } = useLocalSearchParams<{ titulo?: string; descripcion?: string; origen?: string }>()
  const precarga = titulo ? { titulo, descripcion, origen } : null
  return <CalendarioScreen key={`${titulo ?? ''}|${origen ?? ''}`} precarga={precarga} />
}
