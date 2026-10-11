import React from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useColors } from '@/libs/theme'
import { TopBar } from '@/core/ui/fw'
import { DepositoCheques } from '@/features/tesoreria/components/DepositoCheques'

/** Depositar cheques de terceros en cartera (lámina DepositoCheques). */
export default function DepositoChequesScreen() {
  const c = useColors()
  const router = useRouter()
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Depositar cheques" subtitle="Cheques de terceros en cartera" leading={{ kind: 'atras', onPress: () => router.back() }} />
      <DepositoCheques />
    </View>
  )
}
