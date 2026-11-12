import React from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColors } from '@/libs/theme'
import { DetalleDePago } from '@/features/pagos/components/DetalleDePago'

/** Detalle de un pago o cobro de Tesorería > Pagos. */
export default function DetalleDePagoScreen() {
  const c = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id?: string }>()
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <DetalleDePago id={id ?? ''} onVolver={() => router.back()} />
    </View>
  )
}
