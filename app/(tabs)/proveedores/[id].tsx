import React from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColors } from '@/libs/theme'
import { TopBar } from '@/core/ui/fw'
import { FichaProveedor } from '@/features/proveedores/components/FichaProveedor'

/** Ficha de proveedor en teléfono; en tablet la misma ficha va en el panel de Proveedores. */
export default function FichaProveedorScreen() {
  const c = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Proveedor" leading={{ kind: 'atras', onPress: () => router.back() }} />
      {id ? <FichaProveedor id={id} /> : null}
    </View>
  )
}
