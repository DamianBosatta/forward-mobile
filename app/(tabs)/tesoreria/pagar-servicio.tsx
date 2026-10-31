import React from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useColors } from '@/libs/theme'
import { TopBar } from '@/core/ui/fw'
import { PagarServicio } from '@/features/gastos/components/PagarServicio'

/** Pago de un servicio o gasto (lámina tesoreria-pagar-servicio). */
export default function PagarServicioScreen() {
  const c = useColors()
  const router = useRouter()
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Pagar un servicio" leading={{ kind: 'atras', onPress: () => router.back() }} />
      <PagarServicio onListo={() => router.back()} />
    </View>
  )
}
