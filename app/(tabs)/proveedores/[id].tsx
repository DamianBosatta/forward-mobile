import React from 'react'
import { View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useColors } from '@/libs/theme'
import { FichaProveedor } from '@/features/proveedores/components/FichaProveedor'

/** Ficha de proveedor en teléfono; en tablet la misma ficha va en el panel de Proveedores. */
export default function FichaProveedorScreen() {
  const c = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {id ? <FichaProveedor id={id} conBarra /> : null}
    </View>
  )
}
