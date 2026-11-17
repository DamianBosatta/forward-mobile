import React from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { idDeRuta, useParametrosDeRuta } from '@/core/navigation/parametrosDeRuta'
import { useColors } from '@/libs/theme'
import { DetalleDePago } from '@/features/pagos/components/DetalleDePago'

/** Detalle de un pago o cobro de Tesorería > Pagos. */
export default function DetalleDePagoScreen() {
  const c = useColors()
  const router = useRouter()
  const { id } = useParametrosDeRuta({ id: idDeRuta })
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {id ? <DetalleDePago id={id} onVolver={() => router.back()} /> : null}
    </View>
  )
}
