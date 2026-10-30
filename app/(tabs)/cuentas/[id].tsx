import React from 'react'
import { View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useColors } from '@/libs/theme'
import { CuentaCorrienteCliente } from '@/features/cuentas/components/CuentaCorrienteCliente'

/** Estado de cuenta de un cliente en teléfono (lámina cuentas-estado); en tablet la misma vista va en el panel de Cuentas. */
export default function CuentaCorrienteScreen() {
  const c = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {id ? <CuentaCorrienteCliente socioId={id} conBarra /> : null}
    </View>
  )
}
