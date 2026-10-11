import React from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColors } from '@/libs/theme'
import { TopBar } from '@/core/ui/fw'
import { CuentaCorrienteCliente } from '@/features/cuentas/components/CuentaCorrienteCliente'

/** Cuenta corriente de un cliente en teléfono; en tablet la misma vista va en el panel de Cuentas corrientes. */
export default function CuentaCorrienteScreen() {
  const c = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Cuenta corriente" leading={{ kind: 'atras', onPress: () => router.back() }} />
      {id ? <CuentaCorrienteCliente socioId={id} /> : null}
    </View>
  )
}
