import React from 'react'
import { View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useColors } from '@/libs/theme'
import { FichaCliente } from '@/features/clientes/components/FichaCliente'

/** Ficha de cliente en teléfono; en tablet la misma ficha va en el panel de Clientes. */
export default function FichaClienteScreen() {
  const c = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {id ? <FichaCliente id={id} conBarra /> : null}
    </View>
  )
}
