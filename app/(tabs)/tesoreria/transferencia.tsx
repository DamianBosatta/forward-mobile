import React from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useColors } from '@/libs/theme'
import { TopBar } from '@/core/ui/fw'
import { Transferencia } from '@/features/tesoreria/components/Transferencia'

/** Movimiento entre cuentas propias (lámina Transferencia). */
export default function TransferenciaScreen() {
  const c = useColors()
  const router = useRouter()
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Transferencia" subtitle="Entre cuentas propias" leading={{ kind: 'atras', onPress: () => router.back() }} />
      <Transferencia onListo={() => router.back()} />
    </View>
  )
}
