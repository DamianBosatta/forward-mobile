import React from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColors } from '@/libs/theme'
import { TopBar } from '@/core/ui/fw'
import { RegistrarCobro } from '@/features/cuentas/components/RegistrarCobro'

/** Registrar un cobro desde la cuenta corriente de un cliente. */
export default function RegistrarCobroScreen() {
  const c = useColors()
  const router = useRouter()
  const { socioId } = useLocalSearchParams<{ socioId: string }>()

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Registrar cobro" subtitle="Cuenta corriente del cliente" leading={{ kind: 'atras', onPress: () => router.back() }} />
      {socioId ? <RegistrarCobro socioId={socioId} onVolver={() => router.back()} /> : null}
    </View>
  )
}
