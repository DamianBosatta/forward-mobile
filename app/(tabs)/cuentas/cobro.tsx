import React from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColors } from '@/libs/theme'
import { RegistrarCobro } from '@/features/cuentas/components/RegistrarCobro'

/** Registrar un cobro desde la cuenta corriente de un cliente. */
export default function RegistrarCobroScreen() {
  const c = useColors()
  const router = useRouter()
  const { socioId, medio } = useLocalSearchParams<{ socioId: string; medio?: string }>()

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {socioId ? <RegistrarCobro socioId={socioId} medioInicial={medio === 'cheque' ? 'cheque' : undefined} onVolver={() => router.back()} conBarra /> : null}
    </View>
  )
}
