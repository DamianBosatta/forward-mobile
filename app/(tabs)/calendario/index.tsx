import React from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CalendarioScreen } from '@/features/calendario/CalendarioScreen'
import { useAvisosNoLeidos } from '@/features/notificaciones'

/** Calendario (PR 5.3). "Agendar" desde una venta llega con título, descripción, número e id de la venta. */
export default function CalendarioRoute() {
  const { titulo, descripcion, origen, ventaId, nonce, nuevo } =
    useLocalSearchParams<{ titulo?: string; descripcion?: string; origen?: string; ventaId?: string; nonce?: string; nuevo?: string }>()
  const router = useRouter()
  const sinLeer = useAvisosNoLeidos()
  const precarga = titulo ? { titulo, descripcion, origen, ventaId } : null
  return (
    <CalendarioScreen
      key={`${titulo ?? ''}|${origen ?? ''}|${nonce ?? ''}|${nuevo ?? ''}`}
      nuevo={nuevo === '1'}
      avisosSinLeer={sinLeer}
      onIrAAvisos={() => router.push('/avisos' as never)}
      precarga={precarga}
      onAbrirVenta={(id) => router.push({ pathname: '/(tabs)/ventas/[id]', params: { id } })}
    />
  )
}
