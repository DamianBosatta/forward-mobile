import React from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColors } from '@/libs/theme'
import { CobroEnPasos } from '@/features/cuentas/components/CobroEnPasos'

/**
 * Pago a proveedor: el cobro en pasos con un proveedor en lugar de un cliente (mismo POST; el servidor deduce que
 * sale plata por el tipo del socio). Con `socioId` (desde "Debo" de Cuentas) el paso 1 se salta.
 */
export default function PagarAProveedorScreen() {
  const c = useColors()
  const router = useRouter()
  const { socioId } = useLocalSearchParams<{ socioId?: string }>()
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <CobroEnPasos contraparte="proveedor" socioId={socioId || undefined} onVolver={() => router.back()} />
    </View>
  )
}
