import React from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColors } from '@/libs/theme'
import { CobroEnPasos } from '@/features/cuentas/components/CobroEnPasos'

/**
 * Cobrar (maqueta "Cobros como venta"): los cuatro pasos de la venta nueva. Con `socioId` (todas las entradas de
 * hoy lo pasan) el paso 1 se salta; sin él, se elige el cliente. El formulario de una sola pantalla
 * (`RegistrarCobro`) sigue en el panel de la tablet de Cuentas.
 */
export default function RegistrarCobroScreen() {
  const c = useColors()
  const router = useRouter()
  const { socioId, medio } = useLocalSearchParams<{ socioId?: string; medio?: string }>()

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <CobroEnPasos socioId={socioId || undefined} medioInicial={medio === 'cheque' ? 'cheque' : undefined} onVolver={() => router.back()} />
    </View>
  )
}
