import React from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useColors } from '@/libs/theme'
import { ListaDePagos } from '@/features/pagos/components/ListaDePagos'

/** Tesorería > Pagos: pagos a proveedores y cobros de clientes (web `/finanzas/pagos`). */
export default function PagosScreen() {
  const c = useColors()
  const router = useRouter()
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ListaDePagos onVolver={() => router.back()} />
    </View>
  )
}
