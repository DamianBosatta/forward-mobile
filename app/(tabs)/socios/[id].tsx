import React from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColors } from '@/libs/theme'
import { TopBar } from '@/core/ui/fw'
import { FichaCliente } from '@/features/clientes/components/FichaCliente'

/** Ficha de cliente en teléfono; en tablet la misma ficha va en el panel de Clientes. */
export default function FichaClienteScreen() {
  const c = useColors()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Cliente" leading={{ kind: 'atras', onPress: () => router.back() }} />
      {id ? <FichaCliente id={id} /> : null}
    </View>
  )
}
